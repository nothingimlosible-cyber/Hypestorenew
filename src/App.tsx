import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  setDoc, 
  doc, 
  serverTimestamp,
  getDocFromServer,
  deleteDoc
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signOut,
  User,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { db, auth } from './lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Zap, 
  Truck, 
  Star, 
  User as UserIcon, 
  LogOut, 
  Plus, 
  ShoppingBag, 
  ChevronRight,
  ChevronLeft,
  Fingerprint,
  Info,
  Trash2,
  Lock,
  Mail
} from 'lucide-react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

interface Product {
  id: string;
  nama: string;
  harga: string;
  link: string;
  images: string[];
  source: string;
  category: string;
  etalaseNo?: string;
  deskripsi?: string;
  createdAt?: any;
}

const CATEGORIES = [
  'All',
  'Fashion',
  'Electronics',
  'Sneakers',
  'Gaming',
  'Lifestyle',
  'Accessories'
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Form state
  const [pName, setPName] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pLink, setPLink] = useState('');
  const [pSource, setPSource] = useState('');
  const [pPCategory, setPCategory] = useState('Fashion');
  const [pEtalase, setPEtalase] = useState('');
  const [pDescription, setPDescription] = useState('');
  const [pFiles, setPFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || []
      },
      operationType,
      path
    }
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }

  useEffect(() => {
    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();

    // Listen for products
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      setProducts(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    // Listen for auth
    const authUnsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      // Admin check
      setIsAdmin(u?.email === "nothingimlosible@gmail.com");
    });

    return () => {
      unsubscribe();
      authUnsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      if (result.user.email !== "nothingimlosible@gmail.com") {
        await signOut(auth);
        alert("Maaf, akses admin hanya untuk pengelola resmi.");
        return;
      }

      alert("Akses Admin Terverifikasi!");
      setShowLoginModal(false);
    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.code === "auth/unauthorized-domain") {
        alert("Domain ini belum terdaftar di Firebase! Tambahkan domain Vercel kakak di Firebase Console > Authentication > Settings > Authorized Domains.");
      } else {
        alert("Gagal login Google: " + (err.message || "Unknown error"));
      }
    }
  };

  const handleLogout = () => signOut(auth);

  const deleteProduct = async (id: string) => {
    if (!window.confirm("Hapus produk ini?")) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      alert("Produk dihapus!");
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus.");
    }
  };

  const startEdit = (p: Product) => {
    setEditingProduct(p);
    setPName(p.nama);
    setPPrice(p.harga);
    setPLink(p.link);
    setPSource(p.source);
    setPCategory(p.category);
    setPEtalase(p.etalaseNo || '');
    setPDescription(p.deskripsi || '');
    setExistingImages(p.images || []);
    setPFiles([]);
    document.getElementById('adminDashboard')?.scrollIntoView({ behavior: 'smooth' });
  };

  const uploadFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const upRes = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64 })
          });
          const upData = await upRes.json();
          if (upData.success) resolve(upData.url);
          else reject(upData.error);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject("File reading failed");
    });
  };

  const saveProduct = async () => {
    if (!pName || !pPrice || !pLink) {
      return alert("Lengkapi data!");
    }

    if (!editingProduct && pFiles.length === 0) {
      return alert("Pilih minimal 1 gambar!");
    }

    setIsSaving(true);
    
    try {
      const uploadedUrls = await Promise.all(pFiles.map(file => uploadFile(file)));
      const finalImages = [...existingImages, ...uploadedUrls];

      const productId = editingProduct ? editingProduct.id : Date.now().toString();
      const productData: any = {
        id: productId,
        nama: pName,
        link: pLink,
        harga: pPrice,
        source: pSource.toUpperCase() || 'SHOPEE',
        category: pCategory,
        etalaseNo: pEtalase,
        deskripsi: pDescription,
        images: finalImages,
        createdAt: editingProduct ? editingProduct.createdAt : serverTimestamp()
      };

      await setDoc(doc(db, 'products', productId), productData);
      alert(editingProduct ? "Diperbarui!" : "Berhasil!");
      
      // Reset
      setPName(''); setPPrice(''); setPLink(''); setPSource(''); setPEtalase(''); setPDescription(''); setPFiles([]); setExistingImages([]);
      setEditingProduct(null);
    } catch (err) {
      alert("Error: " + String(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFF] pb-20 font-sans selection:bg-indigo-100 text-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-md border-b border-slate-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900">HYPE<span className="text-indigo-600">STORE</span></h1>
            </motion.div>
            
            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <a href="#katalog" className="hover:text-indigo-600 transition-colors">Catalogue</a>
                <a href="#trust" className="hover:text-indigo-600 transition-colors">Why Us</a>
              </div>

              <div className="flex items-center gap-4">
                {user ? (
                  <div className="flex items-center gap-3 pl-4 border-l border-slate-100">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-black text-slate-900 uppercase leading-none">{user.displayName || 'Admin Hype'}</p>
                      {isAdmin && <p className="text-[8px] font-bold text-indigo-500 uppercase mt-1">Verified Admin</p>}
                    </div>
                    <div className="relative group">
                      <img src={user.photoURL || 'https://via.placeholder.com/100?text=A'} className="w-8 h-8 rounded-full border-2 border-white shadow-md cursor-pointer hover:border-indigo-100 transition-all" />
                      <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all p-2 z-[100]">
                        <button onClick={handleLogout} className="w-full flex items-center gap-2 p-3 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-lg text-left transition-colors">
                          <LogOut className="w-3.5 h-3.5" /> Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowLoginModal(true)} className="group flex items-center gap-2 p-2 text-slate-400 hover:text-indigo-600 transition-all">
                    <Fingerprint className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </button>
                )}
              </div>
            </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 px-4">
        <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end gap-12 mb-20">
                <div className="max-w-2xl text-left">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 text-[10px] font-black px-4 py-1.5 rounded-full uppercase border border-indigo-100 mb-6"
                  >
                    <ShoppingBag className="w-3 h-3" />
                    Marketplace Curated by Hype Matrix
                  </motion.div>
                  <motion.h2 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    className="text-5xl md:text-8xl font-[900] text-slate-900 tracking-tighter leading-[0.9] italic uppercase"
                  >
                    The Digital <br/><span className="text-indigo-600">Flagship</span> Store.
                  </motion.h2>
                  <p className="text-slate-400 text-sm font-medium mt-8 max-w-md leading-relaxed uppercase tracking-[0.2em]">
                    Kurasi produk pilihan dari berbagai platform marketplace terbaik. Klik, Pilih, dan Belanja melalui link affiliate kami.
                  </p>
                  
                  <div className="flex items-center gap-4 mt-10">
                    <button onClick={() => document.getElementById('katalog')?.scrollIntoView({ behavior: 'smooth' })} className="px-10 py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 transition-all shadow-2xl shadow-slate-900/10 active:scale-95">
                      Explore Catalogue
                    </button>
                    <div className="hidden sm:flex items-center gap-3 pl-6 border-l border-slate-100">
                       <p className="text-[10px] font-black uppercase text-slate-300 tracking-[0.3em]">Scroll to Discover</p>
                    </div>
                  </div>
                </div>
                <div className="hidden lg:block relative">
                   <div className="text-[12rem] font-[900] text-slate-50 leading-none select-none tracking-tighter">HYPE</div>
                   <div className="absolute -bottom-4 right-0 text-indigo-600 font-black italic tracking-widest text-sm uppercase">Official Portfolio v1.0</div>
                </div>
            </div>
        </div>
      </section>

      {/* Trust & Features Section */}
      <section id="trust" className="py-12 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: <ShieldCheck className="w-6 h-6" />, title: 'Verified Quality', desc: 'Setiap produk dikurasi ketat oleh tim HYPESTORE.' },
            { icon: <Zap className="w-6 h-6" />, title: 'Fast Selection', desc: 'Akses instan ke link belanja termurah & terpercaya.' },
            { icon: <Truck className="w-6 h-6" />, title: 'Premium Source', desc: 'Hanya dari seller TikTok & Shopee bintang 5.' }
          ].map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-8 bg-white border border-slate-100 rounded-[2rem] hover:shadow-xl hover:shadow-slate-200/50 transition-all flex flex-col gap-4 group"
            >
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                {item.icon}
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{item.title}</h4>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed font-medium">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Admin Dashboard */}
      {isAdmin && (
        <section id="adminDashboard" className="px-4 mt-4 mb-12">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-7xl mx-auto bg-[#F8FAFF] p-8 rounded-[2.5rem] border-2 border-dashed border-indigo-100 relative overflow-hidden"
            >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center">
                    <Plus className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em]">{editingProduct ? 'Edit Asset' : 'Admin Dashboard — Add New Affiliate Asset'}</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Product Name</label>
                      <input 
                        type="text" 
                        value={pName}
                        onChange={(e) => setPName(e.target.value)}
                        placeholder="Ex: Hoodie Premium" 
                        className="w-full p-4 bg-white rounded-2xl border border-slate-200 outline-none text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Price Tag</label>
                      <input 
                        type="text" 
                        value={pPrice}
                        onChange={(e) => setPPrice(e.target.value)}
                        placeholder="Ex: Rp 249.000" 
                        className="w-full p-4 bg-white rounded-2xl border border-slate-200 outline-none text-sm font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Link Shopee/Tiktok</label>
                      <input 
                        type="url" 
                        value={pLink}
                        onChange={(e) => setPLink(e.target.value)}
                        placeholder="URL" 
                        className="w-full p-4 bg-white rounded-2xl border border-slate-200 outline-none text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Platform</label>
                      <input 
                        type="text" 
                        value={pSource}
                        onChange={(e) => setPSource(e.target.value)}
                        placeholder="SHOPEE / TIKTOK" 
                        className="w-full p-4 bg-white rounded-2xl border border-slate-200 outline-none font-black text-[10px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Category</label>
                      <select 
                        value={pCategory}
                        onChange={(e) => setPCategory(e.target.value)}
                        className="w-full p-4 bg-white rounded-2xl border border-slate-200 outline-none text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                      >
                        {CATEGORIES.filter(c => c !== 'All').map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Etalase No.</label>
                      <input 
                        type="text" 
                        value={pEtalase}
                        onChange={(e) => setPEtalase(e.target.value)}
                        placeholder="Ex: 01" 
                        className="w-full p-4 bg-white rounded-2xl border border-slate-200 outline-none text-sm font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                      />
                    </div>
                    <div className="md:col-span-5 space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Deskripsi Produk</label>
                      <textarea 
                        value={pDescription}
                        onChange={(e) => setPDescription(e.target.value)}
                        placeholder="Tulis detail produk di sini..." 
                        className="w-full p-4 bg-white rounded-2xl border border-slate-200 outline-none text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[100px]" 
                      />
                    </div>
                    <div className="md:col-span-5 space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Images Management (1-6 Images)</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                           {existingImages.map((src, idx) => (
                             <div key={idx} className="relative group w-20 h-20 rounded-xl overflow-hidden border">
                                <img src={src} className="w-full h-full object-cover" />
                                <button 
                                  onClick={() => setExistingImages(curr => curr.filter((_, i) => i !== idx))}
                                  className="absolute inset-0 bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="w-4 h-4 text-white" />
                                </button>
                             </div>
                           ))}
                           {pFiles.map((f, idx) => (
                             <div key={idx} className="relative group w-20 h-20 rounded-xl overflow-hidden border bg-slate-50 flex items-center justify-center">
                                <span className="text-[8px] font-bold text-indigo-500 uppercase">NEW FILE</span>
                                <button 
                                  onClick={() => setPFiles(curr => curr.filter((_, i) => i !== idx))}
                                  className="absolute inset-0 bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="w-4 h-4 text-white" />
                                </button>
                             </div>
                           ))}
                        </div>
                        <input 
                          type="file" 
                          multiple
                          onChange={(e) => setPFiles(curr => [...curr, ...Array.from(e.target.files || [])])}
                          accept="image/*" 
                          className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-[10px] file:mr-4 file:bg-indigo-600 file:text-white file:border-none file:px-4 file:py-1 file:rounded-lg file:font-black file:uppercase file:text-[9px] cursor-pointer" 
                        />
                    </div>
                    <div className="md:col-span-5 flex items-end gap-2">
                      <button 
                        onClick={saveProduct} 
                        disabled={isSaving}
                        className="flex-1 bg-slate-900 text-white h-[60px] rounded-2xl font-black uppercase text-xs hover:bg-indigo-600 transition-all disabled:opacity-50 active:scale-95 shadow-xl shadow-slate-900/10"
                      >
                        {isSaving ? "Syncing..." : (editingProduct ? "Update Asset" : "Publish Asset")}
                      </button>
                      {editingProduct && (
                        <button 
                          onClick={() => {
                            setEditingProduct(null);
                            setPName(''); setPPrice(''); setPLink(''); setPSource(''); setPDescription(''); setPFiles([]); setExistingImages([]);
                          }}
                          className="px-6 bg-red-500 text-white h-[60px] rounded-2xl font-black uppercase text-[10px] active:scale-95"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                </div>
            </motion.div>
        </section>
      )}

      {/* Katalog Section */}
      <section id="katalog" className="px-4 py-12 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-slate-100 pb-8">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                  Live Collection
                </div>
                <h3 className="text-3xl font-[800] text-slate-900 uppercase tracking-tight italic">Our Catalogue.</h3>
              </div>
              <div className="flex overflow-x-auto pb-4 gap-2 no-scrollbar -mx-4 px-4 scroll-smooth">
                {CATEGORIES.map(cat => (
                  <button 
                    key={cat} 
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shrink-0 active:scale-95 shadow-sm ${
                      selectedCategory === cat 
                        ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20 translate-y-[-2px]' 
                        : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            
            {loading ? (
              <div className="flex flex-col justify-center items-center py-32 space-y-4">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse font-mono">Initializing Hype Matrix...</p>
              </div>
            ) : (
              <div id="grid" className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                {products.length === 0 ? (
                  <div className="col-span-full text-center py-24 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                    <Info className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No products found in the vault.</p>
                  </div>
                ) : (
                  products.filter(p => selectedCategory === 'All' || p.category === selectedCategory).map((p, idx) => (
                    <motion.div 
                      key={p.id}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: (idx % 4) * 0.1 }}
                      className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 p-2 shadow-sm group hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.08)] transition-all flex flex-col relative"
                    >
                        {isAdmin && (
                          <div className="absolute top-6 right-6 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button 
                               onClick={(e) => { e.stopPropagation(); startEdit(p); }}
                               className="p-2 bg-white rounded-lg shadow-lg hover:bg-slate-50 text-slate-600"
                             >
                                <Plus className="w-4 h-4 rotate-45" /> {/* Use as x/edit icon alternative */}
                             </button>
                             <button 
                               onClick={(e) => { e.stopPropagation(); deleteProduct(p.id); }}
                               className="p-2 bg-red-500 rounded-lg shadow-lg hover:bg-red-600 text-white"
                             >
                                <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                        )}
                        <div 
                          className="overflow-hidden rounded-[2rem] aspect-[3/4] bg-slate-50 relative cursor-pointer"
                          onClick={() => { setSelectedProduct(p); setCurrentImgIndex(0); }}
                        >
                            <img 
                              src={p.images?.[0] || 'https://via.placeholder.com/600x800?text=No+Image'} 
                              alt={p.nama}
                              className="w-full h-full object-cover group-hover:scale-105 duration-700 transition-transform" 
                              loading="lazy"
                              onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/600x800?text=No+Image' }}
                            />
                            <div className="absolute top-4 left-4 flex flex-col gap-2">
                               <span className="bg-white/90 backdrop-blur-md text-slate-900 text-[8px] font-black px-3 py-1 rounded-full shadow-sm border border-white/20 uppercase tracking-widest">
                                  {p.source || 'AFFILIATE'}
                               </span>
                               {p.etalaseNo && (
                                 <span className="bg-indigo-600 text-white text-[8px] font-black px-3 py-1 rounded-full shadow-sm uppercase tracking-widest self-start">
                                    Etalase {p.etalaseNo}
                                 </span>
                               )}
                               <span className="bg-slate-900 text-white text-[7px] font-black px-2 py-1 rounded-full shadow-sm uppercase tracking-widest self-start opacity-60">
                                  {p.category}
                               </span>
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                               <span className="text-white text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 translate-y-4 group-hover:translate-y-0 transition-transform">
                                  View Details <ChevronRight className="w-3 h-3" />
                               </span>
                            </div>
                        </div>
                        <div className="p-6 text-left flex-1 flex flex-col">
                            <div className="flex justify-between items-start mb-2 group-hover:text-indigo-600 transition-colors">
                                <h3 className="text-[13px] font-black uppercase text-slate-900 leading-tight tracking-tight line-clamp-1 flex-1 group-hover:text-indigo-600 font-sans">{p.nama || 'Unnamed Product'}</h3>
                                <span className="text-indigo-600 font-mono text-[10px] font-black ml-2 shrink-0">{p.harga || 'CHECK'}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">{p.source || 'Marketplace'} Affiliate</p>
                            
                            <div className="mt-auto flex gap-2">
                               <button 
                                 onClick={() => { setSelectedProduct(p); setCurrentImgIndex(0); }}
                                 className="flex-1 py-3.5 bg-slate-50 text-slate-400 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95"
                               >
                                 Detail
                               </button>
                               <a 
                                 href={p.link} 
                                 target="_blank" 
                                 rel="noopener noreferrer" 
                                 className="flex-[2.5] bg-slate-900 text-white py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest text-center hover:bg-indigo-600 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                                 onClick={(e) => e.stopPropagation()}
                               >
                                 Buy Now
                               </a>
                            </div>
                        </div>
                    </motion.div>
                  ))
                )}
              </div>
            )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 mt-20 py-20 px-6 bg-slate-50/50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12 text-center md:text-left">
          <div className="space-y-4 max-w-xs">
            <div className="flex items-center gap-2 justify-center md:justify-start">
               <div className="w-6 h-6 bg-slate-900 rounded-md flex items-center justify-center">
                 <ShoppingBag className="w-3.5 h-3.5 text-white" />
               </div>
               <h3 className="text-lg font-black italic">HYPESTORE.</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">Platform katalog terkurasi untuk gaya hidup modern. Temukan gaya terbaikmu bersama kami.</p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-12 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
             <div className="space-y-4 italic">
                <p className="text-slate-900">Catalogue</p>
                <a href="#" className="block hover:text-indigo-600 transition-colors">Trending</a>
                <a href="#" className="block hover:text-indigo-600 transition-colors">On Sale</a>
             </div>
             <div className="space-y-4">
                <p className="text-slate-900">Support</p>
                <a href="#" className="block hover:text-indigo-600 transition-colors">Contact</a>
                <a href="#" className="block hover:text-indigo-600 transition-colors">Privacy</a>
             </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto border-t border-slate-100 mt-20 pt-10 flex flex-col md:flex-row justify-between items-center gap-6">
           <p className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-400">© HYPESTORE AFFILIATE • NOTHINGIMLOSIBLE</p>
           <div className="flex gap-6">
              {['instagram', 'twitter', 'tiktok'].map(social => (
                <a key={social} href="#" className="text-slate-300 hover:text-indigo-600 transition-colors">
                  <i className={`fab fa-${social} text-lg`}></i>
                </a>
              ))}
           </div>
        </div>
      </footer>
      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-4 sm:p-10"
            onClick={() => setSelectedProduct(null)}
          >
             <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white w-full max-w-5xl rounded-[3rem] overflow-hidden relative shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
             >
                <div className="md:w-1/2 h-[40vh] md:h-auto bg-slate-100 relative group/slider">
                   <AnimatePresence mode="wait">
                      <motion.img 
                        key={currentImgIndex}
                        src={selectedProduct.images?.[currentImgIndex]} 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="w-full h-full object-cover" 
                      />
                   </AnimatePresence>
                   
                   {selectedProduct.images && selectedProduct.images.length > 1 && (
                     <>
                        <button 
                          onClick={() => setCurrentImgIndex(prev => prev === 0 ? selectedProduct.images.length - 1 : prev - 1)}
                          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/20 backdrop-blur-md text-white rounded-full opacity-0 group-hover/slider:opacity-100 transition-opacity hover:bg-white/40"
                        >
                           <ChevronLeft className="w-6 h-6" />
                        </button>
                        <button 
                          onClick={() => setCurrentImgIndex(prev => prev === selectedProduct.images.length - 1 ? 0 : prev + 1)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/20 backdrop-blur-md text-white rounded-full opacity-0 group-hover/slider:opacity-100 transition-opacity hover:bg-white/40"
                        >
                           <ChevronRight className="w-6 h-6" />
                        </button>
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 px-4 py-2 bg-black/10 backdrop-blur-md rounded-full">
                           {selectedProduct.images.map((_, i) => (
                             <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === currentImgIndex ? 'w-4 bg-white' : 'w-1 bg-white/40'}`} />
                           ))}
                        </div>
                     </>
                   )}
                </div>
                <div className="md:w-1/2 p-8 md:p-16 flex flex-col justify-center overflow-y-auto">
                   <div className="flex items-center gap-2 mb-4">
                      {selectedProduct.etalaseNo && (
                         <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-full uppercase">
                            Etalase {selectedProduct.etalaseNo}
                         </span>
                      )}
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-full uppercase border border-indigo-100">
                         {selectedProduct.source}
                      </span>
                      <span className="px-3 py-1 bg-slate-900 text-white text-[10px] font-black rounded-full uppercase">
                         {selectedProduct.category}
                      </span>
                   </div>
                   <h2 className="text-3xl md:text-5xl font-[800] text-slate-900 tracking-tight leading-tight italic uppercase">{selectedProduct.nama}</h2>
                   <p className="text-2xl font-black text-indigo-600 mt-4 mb-8 font-mono">{selectedProduct.harga}</p>
                   
                   <div className="space-y-4 mb-10">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Detail Produk</p>
                      <p className="text-slate-500 text-sm leading-relaxed font-medium whitespace-pre-wrap">
                         {selectedProduct.deskripsi || "Tidak ada deskripsi tambahan untuk produk ini. Namun setiap produk di HYPESTORE telah melalui kurasi kualitas premium."}
                      </p>
                   </div>

                   <a 
                      href={selectedProduct.link} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs text-center hover:bg-indigo-600 transition-all shadow-2xl shadow-indigo-500/20 active:scale-95"
                   >
                      Beli di {selectedProduct.source}
                   </a>

                   <button 
                     onClick={() => setSelectedProduct(null)}
                     className="absolute top-8 right-8 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"
                   >
                      <Plus className="w-6 h-6 rotate-45 text-slate-400" />
                   </button>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6"
            onClick={() => setShowLoginModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white p-10 rounded-[3rem] w-full max-w-sm shadow-2xl text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-blue-600" />
              
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <ShieldCheck className="w-8 h-8 text-indigo-600" />
              </div>
              
              <h3 className="font-black text-slate-900 uppercase tracking-[0.2em] text-xs mb-4">Admin Authentication</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-8 tracking-widest">Akses khusus pengelola HYPESTORE</p>
              
              <button 
                onClick={handleGoogleLogin}
                className="w-full py-6 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center gap-4 hover:bg-indigo-600 transition-all active:scale-95 shadow-xl shadow-slate-900/10"
              >
                 <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" />
                 <span className="text-xs font-black uppercase tracking-widest text-white">Login with Google</span>
              </button>

              <button 
                onClick={() => setShowLoginModal(false)}
                className="mt-12 text-[9px] font-black uppercase tracking-[0.3em] text-slate-300 hover:text-slate-500 transition-colors"
              >
                Kembali ke Katalog
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
