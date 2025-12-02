/**
 * Form Category Controller
 * Manages Form Category CRUD operations
 * All operations POST to FormCategory webhook
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';

export class FormCategoryController {
  /**
   * GET /form-categories
   * List all form categories
   */
  async listCategories(req: Request, res: Response): Promise<void> {
    try {
      // Allow authenticated users (filtered by role in routes if needed)
      const allData = await n8nClient.getAllData();
      const categories = allData['Form Categories'] || [];

      res.json({
        success: true,
        data: categories.map((cat) => ({
          id: cat.id,
          categoryId: cat['Category ID'],
          categoryName: cat['Category Name'],
          description: cat.Description,
          displayOrder: cat['Display Order'],
          active: cat.Active,
        })),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch form categories',
      });
    }
  }

  /**
   * GET /form-categories/:id
   * Get single form category
   */
  async getCategory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const allData = await n8nClient.getAllData();
      const categories = allData['Form Categories'] || [];
      const category = categories.find((c) => c.id === id);

      if (!category) {
        res.status(404).json({ success: false, error: 'Form category not found' });
        return;
      }

      res.json({
        success: true,
        data: {
          id: category.id,
          categoryId: category['Category ID'],
          categoryName: category['Category Name'],
          description: category.Description,
          displayOrder: category['Display Order'],
          active: category.Active,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch form category',
      });
    }
  }

  /**
   * POST /form-categories
   * Create new form category
   * Always sends to FormCategory webhook
   */
  async createCategory(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || (req.user.role !== 'credit_team' && req.user.role !== 'kam')) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { categoryName, description, displayOrder, active } = req.body;

      // Generate IDs
      const id = `CAT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const categoryId = id;

      // Prepare data with exact fields for FormCategory webhook
      const categoryData = {
        id: id, // for matching
        'Category ID': categoryId,
        'Category Name': categoryName || '',
        'Description': description || '',
        'Display Order': displayOrder?.toString() || '0',
        'Active': active !== undefined ? (active ? 'True' : 'False') : 'True',
      };

      // POST to FormCategory webhook
      await n8nClient.postFormCategory(categoryData);

      // Log admin activity
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user.email,
        'Action Type': 'create_form_category',
        'Description/Details': `Created form category: ${categoryName}`,
        'Target Entity': 'form_category',
      });

      res.json({
        success: true,
        data: categoryData,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create form category',
      });
    }
  }

  /**
   * PATCH /form-categories/:id
   * Update form category
   * Always sends to FormCategory webhook
   */
  async updateCategory(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || (req.user.role !== 'credit_team' && req.user.role !== 'kam')) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { id } = req.params;
      const { categoryName, description, displayOrder, active } = req.body;

      // Get existing category data
      const allData = await n8nClient.getAllData();
      const categories = allData['Form Categories'] || [];
      const existingCategory = categories.find((c) => c.id === id);

      if (!existingCategory) {
        res.status(404).json({ success: false, error: 'Form category not found' });
        return;
      }

      // Prepare updated data with exact fields for FormCategory webhook
      const categoryData = {
        id: id, // for matching
        'Category ID': existingCategory['Category ID'] || id,
        'Category Name': categoryName !== undefined ? categoryName : existingCategory['Category Name'],
        'Description': description !== undefined ? description : existingCategory.Description,
        'Display Order': displayOrder !== undefined ? displayOrder.toString() : existingCategory['Display Order'],
        'Active': active !== undefined ? (active ? 'True' : 'False') : existingCategory.Active,
      };

      // Always POST to FormCategory webhook for updates
      await n8nClient.postFormCategory(categoryData);

      // Log admin activity
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user.email,
        'Action Type': 'update_form_category',
        'Description/Details': `Updated form category: ${categoryData['Category Name']}`,
        'Target Entity': 'form_category',
      });

      res.json({
        success: true,
        data: categoryData,
        message: 'Form category updated successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update form category',
      });
    }
  }

  /**
   * DELETE /form-categories/:id
   * Delete/Deactivate form category
   */
  async deleteCategory(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || (req.user.role !== 'credit_team' && req.user.role !== 'kam')) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { id } = req.params;

      // Get existing category
      const allData = await n8nClient.getAllData();
      const categories = allData['Form Categories'] || [];
      const existingCategory = categories.find((c) => c.id === id);

      if (!existingCategory) {
        res.status(404).json({ success: false, error: 'Form category not found' });
        return;
      }

      // Update status to False instead of deleting
      const categoryData = {
        id: id, // for matching
        'Category ID': existingCategory['Category ID'] || id,
        'Category Name': existingCategory['Category Name'],
        'Description': existingCategory.Description,
        'Display Order': existingCategory['Display Order'],
        'Active': 'False',
      };

      // POST to FormCategory webhook
      await n8nClient.postFormCategory(categoryData);

      // Log admin activity
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user.email,
        'Action Type': 'delete_form_category',
        'Description/Details': `Deactivated form category: ${existingCategory['Category Name']}`,
        'Target Entity': 'form_category',
      });

      res.json({
        success: true,
        message: 'Form category deactivated successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete form category',
      });
    }
  }
}

export const formCategoryController = new FormCategoryController();

