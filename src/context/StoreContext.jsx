import { createContext, useContext, useReducer, useEffect } from 'react';

const StoreContext = createContext();

// Survives a refresh within the tab, but not a new visit — the server
// re-validates the code at checkout anyway.
const savedCoupon = () => {
  try { return JSON.parse(sessionStorage.getItem('mj-coupon') || 'null'); } catch { return null; }
};
const saveCoupon = (coupon) => {
  try {
    if (coupon) sessionStorage.setItem('mj-coupon', JSON.stringify(coupon));
    else sessionStorage.removeItem('mj-coupon');
  } catch { /* storage unavailable — coupon just won't survive a refresh */ }
};

const initialState = {
  products: [],
  cart: JSON.parse(localStorage.getItem('mj-cart') || '[]'),
  wishlist: JSON.parse(localStorage.getItem('mj-wishlist') || '[]'),
  user: JSON.parse(localStorage.getItem('mj-user') || 'null'),
  orders: [],
  notifications: [],
  searchQuery: '',
  selectedCategory: 'all',
  coupon: savedCoupon(), // { code, discountType, value, minOrderValue }
  loading: true,
};

function storeReducer(state, action) {
  switch (action.type) {
    case 'SET_PRODUCTS':
      return { ...state, products: action.payload, loading: false };
    
    case 'SET_ORDERS':
      return { ...state, orders: action.payload };

    case 'ADD_TO_CART': {
      const existing = state.cart.find(
        item => item.id === action.payload.id && item.size === action.payload.size && item.sizeType === action.payload.sizeType
      );
      let newCart;
      if (existing) {
        newCart = state.cart.map(item =>
          item.id === action.payload.id && item.size === action.payload.size && item.sizeType === action.payload.sizeType
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        newCart = [...state.cart, { ...action.payload, quantity: 1 }];
      }
      localStorage.setItem('mj-cart', JSON.stringify(newCart));
      return { ...state, cart: newCart };
    }

    case 'REMOVE_FROM_CART': {
      const newCart = state.cart.filter(
        item => !(item.id === action.payload.id && item.size === action.payload.size)
      );
      localStorage.setItem('mj-cart', JSON.stringify(newCart));
      return { ...state, cart: newCart };
    }

    case 'UPDATE_CART_QUANTITY': {
      const newCart = state.cart.map(item =>
        item.id === action.payload.id && item.size === action.payload.size
          ? { ...item, quantity: Math.max(1, action.payload.quantity) }
          : item
      );
      localStorage.setItem('mj-cart', JSON.stringify(newCart));
      return { ...state, cart: newCart };
    }

    case 'CLEAR_CART': {
      localStorage.setItem('mj-cart', '[]');
      return { ...state, cart: [] };
    }

    case 'TOGGLE_WISHLIST': {
      const exists = state.wishlist.includes(action.payload);
      const newWishlist = exists
        ? state.wishlist.filter(id => id !== action.payload)
        : [...state.wishlist, action.payload];
      localStorage.setItem('mj-wishlist', JSON.stringify(newWishlist));
      return { ...state, wishlist: newWishlist };
    }

    case 'SET_USER': {
      localStorage.setItem('mj-user', JSON.stringify(action.payload));
      return { ...state, user: action.payload };
    }

    case 'LOGOUT': {
      localStorage.removeItem('mj-user');
      return { ...state, user: null, orders: [] };
    }

    case 'PLACE_ORDER': {
      saveCoupon(null);
      localStorage.setItem('mj-cart', '[]');
      const newOrders = [action.payload, ...state.orders];
      return { ...state, orders: newOrders, cart: [], coupon: null };
    }

    case 'ADD_NOTIFICATION': {
      return {
        ...state,
        notifications: [action.payload, ...state.notifications].slice(0, 10),
      };
    }

    case 'REMOVE_NOTIFICATION': {
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
      };
    }

    case 'SET_SEARCH': {
      return { ...state, searchQuery: action.payload };
    }

    case 'SET_COUPON': {
      saveCoupon(action.payload);
      return { ...state, coupon: action.payload };
    }

    case 'SET_CATEGORY': {
      return { ...state, selectedCategory: action.payload };
    }

    case 'UPDATE_PRODUCT_STOCK': {
      const updatedProducts = state.products.map(p =>
        p.id === action.payload.id
          ? { ...p, stock: action.payload.stock }
          : p
      );
      return { ...state, products: updatedProducts };
    }

    case 'ADD_PRODUCT': {
      return { ...state, products: [...state.products, action.payload] };
    }

    case 'DELETE_PRODUCT': {
      return {
        ...state,
        products: state.products.filter(p => p.id !== action.payload),
      };
    }

    case 'EDIT_PRODUCT': {
      const updatedProducts = state.products.map(p =>
        p.id === action.payload.id ? { ...p, ...action.payload } : p
      );
      return { ...state, products: updatedProducts };
    }

    default:
      return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(storeReducer, initialState);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        const querySnapshot = await getDocs(collection(db, 'products'));
        const products = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        dispatch({ type: 'SET_PRODUCTS', payload: products });
      } catch (error) {
        console.error('Failed to fetch products', error);
        dispatch({ type: 'SET_PRODUCTS', payload: [] });
      }
    };
    fetchData();
  }, []);

  // Auth state listener
  useEffect(() => {
    const setupAuth = async () => {
      const { onAuthStateChanged } = await import('firebase/auth');
      const { doc, getDoc } = await import('firebase/firestore');
      const { auth, db } = await import('../firebase');
      
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          try {
            const userDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
            let userData = { role: 'user', name: firebaseUser.displayName || 'User', email: firebaseUser.email };
            if (userDocSnap.exists()) {
              userData = userDocSnap.data();
            }
            dispatch({ type: 'SET_USER', payload: { ...userData, id: firebaseUser.uid } });
          } catch (err) {
            console.error('Error fetching user doc:', err);
          }
        } else {
          dispatch({ type: 'SET_USER', payload: null });
        }
      });
      return unsubscribe;
    };
    
    let unsub;
    setupAuth().then(u => unsub = u);
    return () => {
      if (unsub) unsub();
    }
  }, []);

  // Fetch orders if user is logged in
  useEffect(() => {
    const fetchOrders = async () => {
      if (!state.user) return;
      try {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        let q;
        if (state.user.role === 'admin') {
           q = query(collection(db, 'orders'));
        } else {
           q = query(collection(db, 'orders'), where('userId', '==', state.user.id));
        }
        
        const querySnapshot = await getDocs(q);
        const mappedOrders = querySnapshot.docs.map(document => {
          const data = document.data();
          // Ensure it has date and total fields expected by UI
          return { ...data, id: document.id, date: data.createdAt || new Date().toISOString(), total: data.totalAmount };
        });
        
        // Sort orders descending
        mappedOrders.sort((a,b) => new Date(b.date) - new Date(a.date));
        
        dispatch({ type: 'SET_ORDERS', payload: mappedOrders });
      } catch (error) {
        console.error('Failed to fetch orders', error);
      }
    };
    fetchOrders();
  }, [state.user]);

  const cartTotal = state.cart.reduce(
    (sum, item) => sum + item.price * item.quantity, 0
  );
  const cartCount = state.cart.reduce(
    (sum, item) => sum + item.quantity, 0
  );

  return (
    <StoreContext.Provider value={{ state, dispatch, cartTotal, cartCount }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
