import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

/**
 * Hook to manage navigation and active item state based on current route
 */
export const useNavigation = (sidebarItems: Array<{ id: string; path: string }>) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState('dashboard');

  // Update activeItem based on current route
  useEffect(() => {
    const currentPath = location.pathname;
    
    // Find matching sidebar item
    const matchingItem = sidebarItems.find(item => {
      // Exact match
      if (item.path === currentPath) return true;
      
      // Match for detail pages (e.g., /applications/:id should show applications as active)
      if (currentPath.startsWith(item.path + '/')) return true;
      
      // Match for query params (e.g., /applications?status=pending)
      if (currentPath.split('?')[0] === item.path) return true;
      
      return false;
    });
    
    if (matchingItem) {
      setActiveItem(matchingItem.id);
    } else {
      // Default based on path
      const pathParts = currentPath.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        setActiveItem(pathParts[0]);
      }
    }
  }, [location.pathname, sidebarItems]);

  const handleNavigation = (id: string) => {
    const item = sidebarItems.find(i => i.id === id);
    if (item) {
      navigate(item.path);
      setActiveItem(id);
    }
  };

  return {
    activeItem,
    handleNavigation,
    navigate,
    currentPath: location.pathname,
  };
};

