/**
 * React Hook for API Service
 * Provides convenient hooks for API calls with loading/error states
 */

import { useState, useCallback } from 'react';
import { ApiResponse } from '../services/api';

export function useApiCall<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(async (apiCall: () => Promise<ApiResponse<T>>) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiCall();
      
      if (response.success && response.data) {
        setData(response.data);
        return { success: true, data: response.data };
      } else {
        setError(response.error || 'Unknown error');
        return { success: false, error: response.error };
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Network error';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return { loading, error, data, execute, reset };
}

export function useApiMutation<T, P = any>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (
    apiCall: (params: P) => Promise<ApiResponse<T>>,
    params: P
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiCall(params);
      
      if (response.success) {
        return { success: true, data: response.data };
      } else {
        setError(response.error || 'Unknown error');
        return { success: false, error: response.error };
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Network error';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, mutate };
}

