const express = require('express');
const axios = require('axios');
const Fund = require('../models/fundcollectionmodel.js');
const LatestNav = require('../models/navcollectionmodel.js');
const NavHistory = require('../models/navhistorymodel.js');

const router = express.Router();


// 1. SYNC FUNDS FROM EXTERNAL API (One-time setup)

router.post('/sync-funds', async (req, res) => {
  try {
    console.log('🚀 Starting fund data synchronization...');
    
    // Fetch all funds from external API
    const response = await axios.get('https://api.mfapi.in/mf');
    const externalFunds = response.data;
    
    if (!Array.isArray(externalFunds)) {
      throw new Error('Invalid response from external API');
    }

    console.log(`📥 Fetched ${externalFunds.length} funds from external API`);
    
    // Prepare data for insertion
    const fundsToInsert = externalFunds.map(fund => ({
      schemeCode: parseInt(fund.schemeCode),
      schemeName: fund.schemeName,
      fundHouse: fund.fundHouse || 'Unknown'
    }));

    // Insert funds in batches
    const batchSize = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < fundsToInsert.length; i += batchSize) {
      const batch = fundsToInsert.slice(i, i + batchSize);
      try {
        await Fund.insertMany(batch, { ordered: false });
        insertedCount += batch.length;
      } catch (error) {
        if (error.code === 11000) {
          // Handle duplicates
          const duplicateCount = error.writeErrors?.length || 0;
          insertedCount += (batch.length - duplicateCount);
        } else {
          throw error;
        }
      }
    }

    console.log(`✅ Successfully synchronized ${insertedCount} funds`);
    
    res.status(200).json({
      success: true,
      message: `Fund data synchronized successfully`,
      totalFunds: insertedCount,
      externalTotal: externalFunds.length
    });

  } catch (error) {
    console.error('❌ Fund sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync fund data',
      error: error.message
    });
  }
});


// 2. SEARCH FUNDS API (For frontend fund selection)

router.get('/search', async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    
    let query = {};
    if (q) {
      query = {
        $or: [
          { schemeName: { $regex: q, $options: 'i' } },
          { fundHouse: { $regex: q, $options: 'i' } }
        ]
      };
    }

    const skip = (page - 1) * limit;
    
    const [funds, totalCount] = await Promise.all([
      Fund.find(query)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Fund.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      success: true,
      data: {
        funds: funds.map(fund => ({
          schemeCode: fund.schemeCode,
          schemeName: fund.schemeName,
          fundHouse: fund.fundHouse
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalFunds: totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Fund search error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});


// 3. GET NAV HISTORY FOR SPECIFIC FUND

router.get('/:schemeCode/nav', async (req, res) => {
  try {
    const { schemeCode } = req.params;

    if (!schemeCode || isNaN(schemeCode)) {
      return res.status(400).json({
        success: false,
        message: 'Valid scheme code is required'
      });
    }

    // Get fund details
    const fund = await Fund.findOne({ schemeCode: parseInt(schemeCode) });
    if (!fund) {
      return res.status(404).json({
        success: false,
        message: 'Fund not found'
      });
    }

    // Try to get from our database first
    let navHistory = await NavHistory.find({ schemeCode: parseInt(schemeCode) })
      .sort({ date: -1 })
      .limit(30)
      .lean();

    // If no data in our database, fetch from external API
    if (navHistory.length === 0) {
      try {
        console.log(`Fetching NAV history for scheme ${schemeCode} from external API...`);
        const response = await axios.get(`https://api.mfapi.in/mf/${schemeCode}`);
        const externalNavData = response.data;

        if (externalNavData && externalNavData.data) {
          // Store historical data
          const navEntries = externalNavData.data.slice(0, 30).map(entry => ({
            schemeCode: parseInt(schemeCode),
            nav: parseFloat(entry.nav),
            date: entry.date
          }));

          // Insert into our database for future use
          await NavHistory.insertMany(navEntries, { ordered: false });
          navHistory = navEntries;

          // Also update latest NAV
          if (externalNavData.data.length > 0) {
            const latestEntry = externalNavData.data[0];
            await LatestNav.findOneAndUpdate(
              { schemeCode: parseInt(schemeCode) },
              {
                schemeCode: parseInt(schemeCode),
                nav: parseFloat(latestEntry.nav),
                date: latestEntry.date,
                updatedAt: new Date()
              },
              { upsert: true }
            );
          }
        }
      } catch (apiError) {
        console.error('External API error:', apiError.message);
        // Continue with empty array if external API fails
      }
    }

    // Get current NAV
    const currentNav = await LatestNav.findOne({ schemeCode: parseInt(schemeCode) });

    res.status(200).json({
      success: true,
      data: {
        schemeCode: parseInt(schemeCode),
        schemeName: fund.schemeName,
        currentNav: currentNav?.nav || 0,
        asOn: currentNav?.date || 'N/A',
        history: navHistory.map(entry => ({
          date: entry.date,
          nav: entry.nav
        }))
      }
    });

  } catch (error) {
    console.error('NAV history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});


// 4. UPDATE NAV FOR SPECIFIC FUND (Manual trigger)

router.post('/:schemeCode/update-nav', async (req, res) => {
  try {
    const { schemeCode } = req.params;

    if (!schemeCode || isNaN(schemeCode)) {
      return res.status(400).json({
        success: false,
        message: 'Valid scheme code is required'
      });
    }

    // Fetch latest NAV from external API
    const response = await axios.get(`https://api.mfapi.in/mf/${schemeCode}/latest`);
    const latestNavData = response.data;

    if (!latestNavData || !latestNavData.data || latestNavData.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'NAV data not available for this fund'
      });
    }

    const navEntry = latestNavData.data[0];

    // Update latest NAV
    await LatestNav.findOneAndUpdate(
      { schemeCode: parseInt(schemeCode) },
      {
        schemeCode: parseInt(schemeCode),
        nav: parseFloat(navEntry.nav),
        date: navEntry.date,
        updatedAt: new Date()
      },
      { upsert: true }
    );

    // Add to history if not exists
    await NavHistory.findOneAndUpdate(
      { 
        schemeCode: parseInt(schemeCode),
        date: navEntry.date 
      },
      {
        schemeCode: parseInt(schemeCode),
        nav: parseFloat(navEntry.nav),
        date: navEntry.date
      },
      { upsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'NAV updated successfully',
      data: {
        schemeCode: parseInt(schemeCode),
        nav: parseFloat(navEntry.nav),
        date: navEntry.date
      }
    });

  } catch (error) {
    console.error('NAV update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update NAV',
      error: error.message
    });
  }
});

module.exports = router;