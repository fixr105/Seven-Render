/**
 * Products Controller
 * Handles loan products and NBFC partners
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { dataFilterService } from '../services/airtable/dataFilter.service.js';

export class ProductsController {
  /**
   * GET /loan-products
   * List all loan products
   */
  async listLoanProducts(req: Request, res: Response): Promise<void> {
    try {
      const allData = await n8nClient.getAllData();
      const products = allData['Loan Products'] || [];

      // Filter active products if requested
      const { activeOnly } = req.query;
      let filteredProducts = products;
      
      if (activeOnly === 'true') {
        filteredProducts = products.filter((p: any) => p.Active === 'True');
      }

      res.json({
        success: true,
        data: filteredProducts.map((product: any) => ({
          id: product.id,
          productId: product['Product ID'],
          productName: product['Product Name'],
          description: product['Description'],
          active: product['Active'] === 'True',
          requiredDocumentsFields: product['Required Documents/Fields'],
        })),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch loan products',
      });
    }
  }

  /**
   * GET /loan-products/:id
   * Get single loan product
   */
  async getLoanProduct(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const allData = await n8nClient.getAllData();
      const products = allData['Loan Products'] || [];
      
      const product = products.find((p: any) => p.id === id || p['Product ID'] === id);

      if (!product) {
        res.status(404).json({
          success: false,
          error: 'Loan product not found',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: product.id,
          productId: product['Product ID'],
          productName: product['Product Name'],
          description: product['Description'],
          active: product['Active'] === 'True',
          requiredDocumentsFields: product['Required Documents/Fields'],
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch loan product',
      });
    }
  }

  /**
   * GET /nbfc-partners
   * List all NBFC partners
   */
  async listNBFCPartners(req: Request, res: Response): Promise<void> {
    try {
      const allData = await n8nClient.getAllData();
      const partners = allData['NBFC Partners'] || [];

      // Filter active partners if requested
      const { activeOnly } = req.query;
      let filteredPartners = partners;
      
      if (activeOnly === 'true') {
        filteredPartners = partners.filter((p: any) => p.Active === 'True');
      }

      res.json({
        success: true,
        data: filteredPartners.map((partner: any) => ({
          id: partner.id,
          lenderId: partner['Lender ID'],
          lenderName: partner['Lender Name'],
          contactPerson: partner['Contact Person'],
          contactEmailPhone: partner['Contact Email/Phone'],
          addressRegion: partner['Address/Region'],
          active: partner['Active'] === 'True',
        })),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch NBFC partners',
      });
    }
  }

  /**
   * GET /nbfc-partners/:id
   * Get single NBFC partner
   */
  async getNBFCPartner(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const allData = await n8nClient.getAllData();
      const partners = allData['NBFC Partners'] || [];
      
      const partner = partners.find((p: any) => p.id === id || p['Lender ID'] === id);

      if (!partner) {
        res.status(404).json({
          success: false,
          error: 'NBFC partner not found',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: partner.id,
          lenderId: partner['Lender ID'],
          lenderName: partner['Lender Name'],
          contactPerson: partner['Contact Person'],
          contactEmailPhone: partner['Contact Email/Phone'],
          addressRegion: partner['Address/Region'],
          active: partner['Active'] === 'True',
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch NBFC partner',
      });
    }
  }
}

export const productsController = new ProductsController();

