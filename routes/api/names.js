const express = require('express');
const router = express.Router();

// Import the Name model we created
const Name = require('../../models/name');

/**
 * @route   GET api/names
 * @desc    Get all 99 Names of Allah
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    // Fetch all names from the database and sort them by their ID
    const names = await Name.find().sort({ id: 1 });

    if (!names || names.length === 0) {
      console.log('⚠️ No names found in the database.');
      return res.status(404).json({ msg: 'No names found.' });
    }

    console.log('✅ Names rendered successfully.');
    res.json(names); // Send the list of names as a JSON response

  } catch (err) {
    console.error('❌ Error fetching names from database:', err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;