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
    // CRITICAL: Log immediately to verify controller is being called
    console.log(`🚨 [listLoanProducts] CONTROLLER CALLED - Request received at ${new Date().toISOString()}`);
    console.log(`🚨 [listLoanProducts] Request URL: ${req.url}`);
    console.log(`🚨 [listLoanProducts] Request path: ${req.path}`);
    console.log(`🚨 [listLoanProducts] Request method: ${req.method}`);
    console.log(`🚨 [listLoanProducts] User: ${req.user ? JSON.stringify(req.user) : 'NO USER'}`);
    try {
      // Re-enable webhook calls - the await fix should make this work now
      console.log(`[listLoanProducts] Fetching loan products...`);
      
      // n8n is fast (~1.08s), so use shorter timeout (5s should be plenty)
      const timeoutMs = 5000; // 5 seconds - n8n responds in ~1.08s
      
      console.log(`[listLoanProducts] Fetching loan products with ${timeoutMs}ms timeout`);
      console.log(`[listLoanProducts] N8N_BASE_URL: ${process.env.N8N_BASE_URL || 'NOT SET - using default'}`);
      
      // Fetch only Loan Products table
      console.log(`[listLoanProducts] Calling n8nClient.fetchTable('Loan Products')...`);
      const products = await n8nClient.fetchTable('Loan Products', true, undefined, timeoutMs);
      console.log(`[listLoanProducts] fetchTable returned ${products.length} products`);
      
      console.log(`[listLoanProducts] Successfully fetched ${products.length} loan products`);

      // Filter active products if requested
      const { activeOnly } = req.query;
      let filteredProducts = products;
      
      if (activeOnly === 'true') {
        filteredProducts = products.filter((p: any) => p.Active === 'True' || p.Active === true);
        console.log(`[listLoanProducts] Filtered to ${filteredProducts.length} active products`);
      }

      res.json({
        success: true,
        data: filteredProducts.map((product: any) => ({
          id: product.id,
          productId: product['Product ID'],
          productName: product['Product Name'],
          description: product['Description'],
          active: product['Active'] === 'True' || product['Active'] === true,
          requiredDocumentsFields: product['Required Documents/Fields'],
        })),
      });
    } catch (error: any) {
      console.error(`[listLoanProducts] ❌ FAILED to fetch loan products:`, error.message);
      console.error(`[listLoanProducts] Error stack:`, error.stack);
      console.error(`[listLoanProducts] Returning empty array to prevent frontend timeout`);
      // Return empty array instead of error to prevent frontend timeout
      // Frontend can handle empty array gracefully
      res.json({
        success: true,
        data: [],
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
      // Fetch only Loan Products table
      const products = await n8nClient.fetchTable('Loan Products');
      
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
      // Fetch only NBFC Partners table
      const partners = await n8nClient.fetchTable('NBFC Partners');

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
      // Fetch only NBFC Partners table
      const partners = await n8nClient.fetchTable('NBFC Partners');
      
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

