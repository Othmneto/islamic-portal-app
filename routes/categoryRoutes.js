// routes/categoryRoutes.js - Category Management Routes

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const User = require('../models/User');
const { logger } = require('../config/logger');
const crypto = require('crypto');

// Default categories
const DEFAULT_CATEGORIES = [
  { name: 'Personal', color: '#3b82f6', icon: 'calendar' }, // Blue
  { name: 'Work', color: '#10b981', icon: 'briefcase' }, // Green
  { name: 'Religious', color: '#8b5cf6', icon: 'mosque' }, // Purple
  { name: 'Prayer', color: '#14b8a6', icon: 'prayer' }, // Teal
  { name: 'Holiday', color: '#f59e0b', icon: 'party' }, // Orange
  { name: 'Meeting', color: '#ef4444', icon: 'users' }, // Red
  { name: 'Family', color: '#ec4899', icon: 'family' } // Pink
];

// Initialize default categories for new users
async function initializeDefaultCategories(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user already has categories
    if (user.customCategories && user.customCategories.length > 0) {
      return user.customCategories;
    }

    // Create default categories
    const categories = DEFAULT_CATEGORIES.map(cat => ({
      id: crypto.randomUUID(),
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      isDefault: true,
      createdAt: new Date()
    }));

    user.customCategories = categories;
    await user.save();

    logger.info(`[Categories] Initialized default categories for user: ${userId}`);
    return categories;
  } catch (error) {
    logger.error('[Categories] Error initializing default categories:', error);
    throw error;
  }
}

// GET /api/categories - Get all categories for user
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Initialize default categories if none exist
    let categories = user.customCategories || [];
    if (categories.length === 0) {
      categories = await initializeDefaultCategories(req.user.id);
    }

    res.json({
      success: true,
      categories: categories,
      totalCategories: categories.length
    });
  } catch (error) {
    logger.error('[Categories] Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

// POST /api/categories - Create custom category
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, color, icon } = req.body;

    // Validation
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Category name is required'
      });
    }

    if (name.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Category name must be less than 50 characters'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check for duplicate category name
    const existingCategory = user.customCategories.find(
      cat => cat.name.toLowerCase() === name.trim().toLowerCase()
    );

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        error: 'Category with this name already exists'
      });
    }

    // Create new category
    const newCategory = {
      id: crypto.randomUUID(),
      name: name.trim(),
      color: color || '#667eea',
      icon: icon || 'calendar',
      isDefault: false,
      createdAt: new Date()
    };

    user.customCategories.push(newCategory);
    await user.save();

    logger.info(`[Categories] Created category "${name}" for user: ${req.user.id}`);

    res.json({
      success: true,
      category: newCategory,
      message: 'Category created successfully'
    });
  } catch (error) {
    logger.error('[Categories] Error creating category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create category'
    });
  }
});

// PUT /api/categories/:id - Update category
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, icon } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const categoryIndex = user.customCategories.findIndex(cat => cat.id === id);
    if (categoryIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    const category = user.customCategories[categoryIndex];

    // Prevent editing default categories' names
    if (category.isDefault && name && name !== category.name) {
      return res.status(400).json({
        success: false,
        error: 'Cannot rename default categories'
      });
    }

    // Validation
    if (name && name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Category name cannot be empty'
      });
    }

    if (name && name.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Category name must be less than 50 characters'
      });
    }

    // Check for duplicate name (excluding current category)
    if (name) {
      const duplicateCategory = user.customCategories.find(
        (cat, idx) => idx !== categoryIndex && cat.name.toLowerCase() === name.trim().toLowerCase()
      );

      if (duplicateCategory) {
        return res.status(400).json({
          success: false,
          error: 'Category with this name already exists'
        });
      }
    }

    // Update category
    if (name) category.name = name.trim();
    if (color) category.color = color;
    if (icon) category.icon = icon;

    user.customCategories[categoryIndex] = category;
    await user.save();

    logger.info(`[Categories] Updated category "${category.name}" for user: ${req.user.id}`);

    res.json({
      success: true,
      category: category,
      message: 'Category updated successfully'
    });
  } catch (error) {
    logger.error('[Categories] Error updating category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update category'
    });
  }
});

// DELETE /api/categories/:id - Delete category
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const categoryIndex = user.customCategories.findIndex(cat => cat.id === id);
    if (categoryIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    const category = user.customCategories[categoryIndex];

    // Prevent deleting default categories
    if (category.isDefault) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete default categories'
      });
    }

    // Check if category is used in any events
    const eventsUsingCategory = user.calendarEvents.filter(
      event => event.category === category.name
    );

    if (eventsUsingCategory.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete category. ${eventsUsingCategory.length} event(s) are using this category.`,
        eventCount: eventsUsingCategory.length
      });
    }

    // Remove category
    user.customCategories.splice(categoryIndex, 1);
    await user.save();

    logger.info(`[Categories] Deleted category "${category.name}" for user: ${req.user.id}`);

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    logger.error('[Categories] Error deleting category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete category'
    });
  }
});

// POST /api/categories/initialize - Initialize default categories
router.post('/initialize', requireAuth, async (req, res) => {
  try {
    const categories = await initializeDefaultCategories(req.user.id);

    res.json({
      success: true,
      categories: categories,
      message: 'Default categories initialized'
    });
  } catch (error) {
    logger.error('[Categories] Error initializing default categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize default categories'
    });
  }
});

module.exports = router;






