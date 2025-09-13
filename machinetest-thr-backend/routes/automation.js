const express = require('express');
const router = express.Router();

// Example route to trigger manual NAV update
router.get('/manual-update', async (req, res) => {
  try {
    await manualNavUpdate();
    res.status(200).json({ success: true, message: 'Manual NAV update triggered.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error triggering manual NAV update.' });
  }
});

// cronJobs.js - Daily NAV update automation

const cron = require('node-cron');
const axios = require('axios');
const Portfolio=require('../models/portifoliomodel.js')
const LatestNav = require('../models/navcollectionmodel.js');
const NavHistory = require('../models/navhistorymodel.js');

// ==============================================
// HELPER FUNCTIONS
// ==============================================

async function fetchLatestNAV(schemeCode) {
  try {
    const response = await axios.get(`https://api.mfapi.in/mf/${schemeCode}/latest`);
    const data = response.data;
    
    if (data && data.data && data.data.length > 0) {
      return {
        nav: parseFloat(data.data[0].nav),
        date: data.data[0].date
      };
    }
    return null;
  } catch (error) {
    console.error(`Failed to fetch NAV for scheme ${schemeCode}:`, error.message);
    return null;
  }
}

async function updateLatestNAV(schemeCode, navData) {
  try {
    await LatestNav.findOneAndUpdate(
      { schemeCode },
      {
        schemeCode,
        nav: navData.nav,
        date: navData.date,
        updatedAt: new Date()
      },
      { upsert: true }
    );
    return true;
  } catch (error) {
    console.error(`Failed to update latest NAV for scheme ${schemeCode}:`, error.message);
    return false;
  }
}

async function addNAVHistory(schemeCode, navData) {
  try {
    await NavHistory.findOneAndUpdate(
      { 
        schemeCode,
        date: navData.date 
      },
      {
        schemeCode,
        nav: navData.nav,
        date: navData.date,
        createdAt: new Date()
      },
      { upsert: true }
    );
    return true;
  } catch (error) {
    console.error(`Failed to add NAV history for scheme ${schemeCode}:`, error.message);
    return false;
  }
}

// ==============================================
// DAILY NAV UPDATE JOB
// ==============================================

const updateNavJob = cron.schedule('0 0 * * *', async () => {
  console.log('🚀 Starting daily NAV update...');
  
  try {
    // Get all unique scheme codes from portfolio collection
    const portfolioSchemes = await Portfolio.distinct('schemeCode');
    
    if (portfolioSchemes.length === 0) {
      console.log('⚠️ No schemes found in portfolios. Skipping NAV update.');
      return;
    }

    console.log(`📊 Found ${portfolioSchemes.length} unique schemes in portfolios`);
    
    let successCount = 0;
    let failureCount = 0;
    
    // Fetch latest NAV for each scheme with delay to avoid rate limiting
    for (let i = 0; i < portfolioSchemes.length; i++) {
      const schemeCode = portfolioSchemes[i];
      
      try {
        // Add delay between requests to avoid rate limiting
        if (i > 0 && i % 10 === 0) {
          console.log(`⏳ Processed ${i} schemes, waiting 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Fetch latest NAV
        const latestNav = await fetchLatestNAV(schemeCode);
        
        if (latestNav) {
          // Update latest NAV collection
          const latestUpdated = await updateLatestNAV(schemeCode, latestNav);
          
          // Add to NAV history collection
          const historyAdded = await addNAVHistory(schemeCode, latestNav);
          
          if (latestUpdated && historyAdded) {
            successCount++;
            console.log(`✅ Updated NAV for scheme ${schemeCode}: ₹${latestNav.nav} (${latestNav.date})`);
          } else {
            failureCount++;
            console.log(`⚠️ Partial update for scheme ${schemeCode}`);
          }
        } else {
          failureCount++;
          console.log(`❌ Failed to fetch NAV for scheme ${schemeCode}`);
        }
        
      } catch (error) {
        failureCount++;
        console.error(`❌ Error processing scheme ${schemeCode}:`, error.message);
      }
    }
    
    console.log(`✅ NAV update completed: ${successCount} successful, ${failureCount} failed`);
    
    // Log statistics
    const totalLatestNav = await LatestNav.countDocuments();
    const totalHistory = await NavHistory.countDocuments();
    console.log(`📈 Database stats - Latest NAV: ${totalLatestNav}, History: ${totalHistory}`);
    
  } catch (error) {
    console.error('❌ Daily NAV update failed:', error);
    // In production, send alert to admin (email/slack notification)
  }
}, {
  scheduled: false, // Don't start automatically
  timezone: "Asia/Kolkata" // IST timezone
});

// ==============================================
// MANUAL NAV UPDATE FUNCTION (for testing)
// ==============================================

async function manualNavUpdate() {
  console.log('🔧 Running manual NAV update...');
  
  try {
    // Get all unique scheme codes from portfolio collection
    const portfolioSchemes = await Portfolio.distinct('schemeCode');
    
    if (portfolioSchemes.length === 0) {
      console.log('⚠️ No schemes found in portfolios.');
      return { success: false, message: 'No schemes to update' };
    }

    console.log(`📊 Updating NAV for ${portfolioSchemes.length} schemes...`);
    
    let successCount = 0;
    let failureCount = 0;
    
    // Process first 5 schemes for testing
    const schemesToProcess = portfolioSchemes.slice(0, 5);
    
    for (const schemeCode of schemesToProcess) {
      try {
        const latestNav = await fetchLatestNAV(schemeCode);
        
        if (latestNav) {
          await updateLatestNAV(schemeCode, latestNav);
          await addNAVHistory(schemeCode, latestNav);
          successCount++;
          console.log(`✅ Updated scheme ${schemeCode}: ₹${latestNav.nav}`);
        } else {
          failureCount++;
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        failureCount++;
        console.error(`❌ Error updating scheme ${schemeCode}:`, error.message);
      }
    }
    
    return {
      success: true,
      message: `Manual update completed: ${successCount} successful, ${failureCount} failed`,
      processed: schemesToProcess.length
    };
    
  } catch (error) {
    console.error('❌ Manual NAV update failed:', error);
    return { success: false, message: error.message };
  }
}

// ==============================================
// START/STOP FUNCTIONS
// ==============================================

function startNavUpdates() {
  updateNavJob.start();
  console.log('⏰ Daily NAV update cron job started (runs at 12:00 AM IST)');
}

function stopNavUpdates() {
  updateNavJob.stop();
  console.log('⏹️ Daily NAV update cron job stopped');
}


module.exports = router;


