const express = require('express');
const jwt = require('jsonwebtoken');
const User=require('../models/usermodel.js')
const Portfolio=require('../models/portifoliomodel.js')
const Fund=require('../models/fundcollectionmodel.js')
const LatestNav=require('../models/navcollectionmodel.js')
const NavHistory=require('../models/navhistorymodel.js')

// const { Portfolio, Fund, LatestNav, NavHistory } = require('../models');
const { authMiddleware } = require('./middleware');

const router = express.Router();

// JWT Secret (In production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';
const JWT_EXPIRES_IN = '24h';


// SIGNUP API

router.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Input validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Username already exists'
      });
    }

    // Create new user (password will be hashed automatically)
    const newUser = new User({
      username: username.toLowerCase().trim(),
      password
    });

    await newUser.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser._id, username: newUser.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: newUser._id,
        username: newUser.username
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});


//login api



router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Input validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Find user by username
    const user = await User.findOne({ 
      username: username.toLowerCase().trim() 
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});


//add the portfolio api

router.use(authMiddleware);
router.post('/add', async (req, res) => {
  try {
    const { schemeCode, units } = req.body;
    const userId = req.userId;

    // Input validation
    if (!schemeCode || !units) {
      return res.status(400).json({
        success: false,
        message: 'Scheme code and units are required'
      });
    }

    if (units <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Units must be greater than 0'
      });
    }

    // Check if fund exists in master data
    const fund = await Fund.findOne({ schemeCode });
    if (!fund) {
      return res.status(404).json({
        success: false,
        message: 'Fund not found. Please check the scheme code.'
      });
    }

    // Check if user already has this fund in portfolio
    const existingEntry = await Portfolio.findOne({ userId, schemeCode });
    
    if (existingEntry) {
      // Update existing entry by adding units
      existingEntry.units += parseFloat(units);
      await existingEntry.save();
      
      return res.status(200).json({
        success: true,
        message: 'Units added to existing fund successfully',
        portfolio: {
          id: existingEntry._id,
          schemeCode: existingEntry.schemeCode,
          schemeName: fund.schemeName,
          units: existingEntry.units,
          addedAt: existingEntry.createdAt
        }
      });
    }

    // Create new portfolio entry
    const newPortfolioEntry = new Portfolio({
      userId,
      schemeCode: parseInt(schemeCode),
      units: parseFloat(units)
    });

    await newPortfolioEntry.save();

    res.status(201).json({
      success: true,
      message: 'Fund added to portfolio successfully',
      portfolio: {
        id: newPortfolioEntry._id,
        schemeCode: newPortfolioEntry.schemeCode,
        schemeName: fund.schemeName,
        units: newPortfolioEntry.units,
        addedAt: newPortfolioEntry.createdAt
      }
    });

  } catch (error) {
    console.error('Add portfolio error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});



//geting the list

router.get('/list', async (req, res) => {
  try {
    const userId = req.userId;

    // Get user's portfolio with fund details
    const portfolio = await Portfolio.aggregate([
      { $match: { userId: userId } },
      {
        $lookup: {
          from: 'funds',
          localField: 'schemeCode',
          foreignField: 'schemeCode',
          as: 'fundDetails'
        }
      },
      {
        $lookup: {
          from: 'fund_latest_nav',
          localField: 'schemeCode',
          foreignField: 'schemeCode',
          as: 'navDetails'
        }
      },
      {
        $project: {
          schemeCode: 1,
          units: 1,
          createdAt: 1,
          schemeName: { $arrayElemAt: ['$fundDetails.schemeName', 0] },
          fundHouse: { $arrayElemAt: ['$fundDetails.fundHouse', 0] },
          currentNav: { $arrayElemAt: ['$navDetails.nav', 0] },
          navDate: { $arrayElemAt: ['$navDetails.date', 0] },
          currentValue: {
            $multiply: ['$units', { $arrayElemAt: ['$navDetails.nav', 0] }]
          }
        }
      }
    ]);

    const totalHoldings = portfolio.length;
    const totalValue = portfolio.reduce((sum, holding) => sum + (holding.currentValue || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        totalHoldings,
        totalValue: parseFloat(totalValue.toFixed(2)),
        holdings: portfolio.map(holding => ({
          schemeCode: holding.schemeCode,
          schemeName: holding.schemeName || 'Unknown Fund',
          fundHouse: holding.fundHouse || 'Unknown',
          units: holding.units,
          currentNav: holding.currentNav || 0,
          currentValue: parseFloat((holding.currentValue || 0).toFixed(2)),
          navDate: holding.navDate || 'N/A'
        }))
      }
    });

  } catch (error) {
    console.error('Portfolio list error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});


//getting the value


router.get('/value', async (req, res) => {
  try {
    const userId = req.userId;

    // Get portfolio with all details for P&L calculation
    const portfolio = await Portfolio.aggregate([
      { $match: { userId: userId } },
      {
        $lookup: {
          from: 'funds',
          localField: 'schemeCode',
          foreignField: 'schemeCode',
          as: 'fundDetails'
        }
      },
      {
        $lookup: {
          from: 'fund_latest_nav',
          localField: 'schemeCode',
          foreignField: 'schemeCode',
          as: 'currentNav'
        }
      }
    ]);

    if (portfolio.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalInvestment: 0,
          currentValue: 0,
          profitLoss: 0,
          profitLossPercent: 0,
          asOn: new Date().toLocaleDateString('en-GB'),
          holdings: []
        }
      });
    }

    let totalCurrentValue = 0;
    let totalInvestment = 0;
    const holdings = [];

    // For simplification, we'll assume invested value = current value for initial implementation
    // In real scenario, you'd track purchase NAV and calculate actual investment
    for (const item of portfolio) {
      const fundDetails = item.fundDetails[0];
      const currentNavData = item.currentNav[0];
      
      const currentNav = currentNavData?.nav || 0;
      const currentValue = item.units * currentNav;
      
      // Simplified: assume invested value = 90% of current value for demo P&L
      const investedValue = currentValue * 0.9;
      
      totalCurrentValue += currentValue;
      totalInvestment += investedValue;
      
      holdings.push({
        schemeCode: item.schemeCode,
        schemeName: fundDetails?.schemeName || 'Unknown Fund',
        units: item.units,
        currentNav: parseFloat(currentNav.toFixed(4)),
        currentValue: parseFloat(currentValue.toFixed(2)),
        investedValue: parseFloat(investedValue.toFixed(2)),
        profitLoss: parseFloat((currentValue - investedValue).toFixed(2))
      });
    }

    const profitLoss = totalCurrentValue - totalInvestment;
    const profitLossPercent = totalInvestment > 0 ? (profitLoss / totalInvestment) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        totalInvestment: parseFloat(totalInvestment.toFixed(2)),
        currentValue: parseFloat(totalCurrentValue.toFixed(2)),
        profitLoss: parseFloat(profitLoss.toFixed(2)),
        profitLossPercent: parseFloat(profitLossPercent.toFixed(2)),
        asOn: new Date().toLocaleDateString('en-GB'),
        holdings
      }
    });

  } catch (error) {
    console.error('Portfolio value error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

//removig the stcoks from the portfolio
router.delete('/remove/:schemeCode', async (req, res) => {
  try {
    const { schemeCode } = req.params;
    const userId = req.userId;

    // Input validation
    if (!schemeCode || isNaN(schemeCode)) {
      return res.status(400).json({
        success: false,
        message: 'Valid scheme code is required'
      });
    }

    // Find and remove the portfolio entry
    const deletedEntry = await Portfolio.findOneAndDelete({
      userId,
      schemeCode: parseInt(schemeCode)
    });

    if (!deletedEntry) {
      return res.status(404).json({
        success: false,
        message: 'Fund not found in your portfolio'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Fund removed from portfolio successfully'
    });

  } catch (error) {
    console.error('Remove portfolio error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});
module.exports = router;