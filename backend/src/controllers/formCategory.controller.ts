/**
 * Form Category Controller
 * @deprecated Form configuration now uses Form Link + Record Titles tables.
 * All endpoints return 410 Gone. Use Form Configuration page (Credit Team) instead.
 */

import { Request, Response } from 'express';

const DEPRECATION_MESSAGE =
  'Form Categories is deprecated. Form configuration now uses Form Link + Record Titles. Use the Form Configuration page (Credit Team) instead.';

export class FormCategoryController {
  async listCategories(req: Request, res: Response): Promise<void> {
    res.status(410).json({
      success: false,
      error: DEPRECATION_MESSAGE,
      code: 'DEPRECATED',
    });
  }

  async getCategory(req: Request, res: Response): Promise<void> {
    res.status(410).json({
      success: false,
      error: DEPRECATION_MESSAGE,
      code: 'DEPRECATED',
    });
  }

  async createCategory(req: Request, res: Response): Promise<void> {
    res.status(410).json({
      success: false,
      error: DEPRECATION_MESSAGE,
      code: 'DEPRECATED',
    });
  }

  async updateCategory(req: Request, res: Response): Promise<void> {
    res.status(410).json({
      success: false,
      error: DEPRECATION_MESSAGE,
      code: 'DEPRECATED',
    });
  }

  async deleteCategory(req: Request, res: Response): Promise<void> {
    res.status(410).json({
      success: false,
      error: DEPRECATION_MESSAGE,
      code: 'DEPRECATED',
    });
  }
}

export const formCategoryController = new FormCategoryController();

