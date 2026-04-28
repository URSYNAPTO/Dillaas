/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { 
  Sparkles, 
  PenTool, 
  FileText, 
  UserCircle, 
  Briefcase, 
  Share2, 
  Minimize2, 
  Mail, 
  X, 
  ArrowRight,
  Globe,
  CheckSquare,
  Loader2,
  Copy,
  Check,
  Search,
  Zap,
  Heart,
  Layout,
  Cpu,
  Layers,
  Star,
  LogIn,
  LogOut,
  Users,
  BarChart,
  Download,
  Shield,
  Settings
} from 'lucide-react';
import { cn } from './lib/utils';
import { TOOLS } from './constants';
import { Tool, User, UsageLog } from './types';
import Markdown from 'react-markdown';
import { auth, db, OperationType, handleFirestoreError } from './lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  serverTimestamp, 
  addDoc,
  onSnapshot,
  getDocFromServer
} from 'firebase/firestore';
import { GoogleGenAI } from "@google/genai";
// import { getStorageUsers, saveStorageUser, getStorageLogs, trackUsage } from './lib/storage'; // Removed local storage

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'home' | 'login' | 'dashboard' | 'admin'>('home');
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  
  // Test Connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data() as User;
            // Update lastActive
            await updateDoc(userRef, { 
              lastActive: new Date().toISOString(),
              updatedAt: serverTimestamp()
            });
            setCurrentUser({ ...userData, lastActive: new Date().toISOString() });
          } else {
            // New user registration
            const newUser: User = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              joinDate: new Date().toISOString(),
              lastActive: new Date().toISOString(),
              toolsUsed: 0,
              favorites: [],
              isAdmin: firebaseUser.email === 'admin@dillaas.lk' // In a real app, this would be set in /admins/
            };
            
            await setDoc(userRef, {
              ...newUser,
              uid: firebaseUser.uid, // Required by rules
              plan: 'free', // Required by rules
              usageCount: 0, // Required by rules
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            
            // If they are an admin, ensure they are in /admins/ too for the exists() rule
            if (newUser.isAdmin) {
               await setDoc(doc(db, 'admins', firebaseUser.uid), { active: true });
            }

            setCurrentUser(newUser);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  const [activeTool, setActiveTool] = useState<Tool | null>(null);
  const [userInput, setUserInput] = useState('');
  const [aiOutput, setAiOutput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [coachCategory, setCoachCategory] = useState('');
  const { scrollY } = useScroll();
  const navBg = useTransform(scrollY, [0, 50], ["rgba(10, 10, 15, 0)", "rgba(10, 10, 15, 0.8)"]);

  const handleRunTool = async () => {
    if (!activeTool || !userInput.trim()) return;
    
    setGenerating(true);
    setAiOutput('');
    
    // Track usage in Firestore
    if (currentUser) {
      try {
        const historyRef = collection(db, 'users', currentUser.id, 'history');
        await addDoc(historyRef, {
          userId: currentUser.id,
          toolId: activeTool.id,
          prompt: userInput,
          timestamp: serverTimestamp()
        });

        // Increment usageCount
        const userRef = doc(db, 'users', currentUser.id);
        await updateDoc(userRef, {
          toolsUsed: (currentUser.toolsUsed || 0) + 1,
          usageCount: (currentUser.toolsUsed || 0) + 1, // rules require this field
          updatedAt: serverTimestamp()
        });
        
        setCurrentUser(prev => prev ? { ...prev, toolsUsed: (prev.toolsUsed || 0) + 1 } : null);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.id}/history`);
      }
    }
    
    try {
      let finalPrompt = activeTool.prompt;
      if (activeTool.id === 'life-coach' && coachCategory) {
        finalPrompt += ` Topic Category: ${coachCategory}.`;
      }
      
      const fullPrompt = `${finalPrompt}\n\nUser Input: ${userInput}`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: fullPrompt,
        config: {
          temperature: 0.7,
          topP: 0.95,
        }
      });

      const text = response.text || "No response generated. Please try again.";
      setAiOutput(text);

    } catch (error: any) {
      console.error('Tool execution error:', error);
      setAiOutput(`Error: ${error.message || "Something went wrong. Please check your connection and try again."}`);
    } finally {
      setGenerating(false);
    }
  };

  const IconMap: Record<string, any> = {
    PenTool, FileText, UserCircle, Briefcase, Share2, Minimize2, Mail, Globe, CheckSquare, Heart
  };

  const filteredTools = TOOLS.filter(tool => 
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(aiOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      setView('home');
    } catch (error: any) {
      console.error('Login error:', error);
      setAuthError(error.message);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('Email/Password login is disabled. Please use Google Login.');
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setView('home');
  };

  useEffect(() => {
    if (view === 'admin' && currentUser?.isAdmin) {
      const fetchAdminData = async () => {
        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          const usersList = usersSnap.docs.map(doc => doc.data() as User);
          setAdminUsers(usersList);
          
          // History logs are scattered across users. For a true admin view,
          // you might want a top-level history collection or group query.
          // For now, let's just use the current users' logs if available.
          setAdminLogs([]); // Placeholder
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'users');
        }
      };
      fetchAdminData();
    }
  }, [view, currentUser]);

  const exportUsersCSV = () => {
    let csv = 'Email,Join Date,Last Active,Tools Used\n';
    adminUsers.forEach(u => {
      csv += `${u.email},${u.joinDate},${u.lastActive},${u.toolsUsed}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'users_list.csv');
    a.click();
  };

  const toggleFavorite = async (e: React.MouseEvent, toolId: string) => {
    e.stopPropagation();
    if (!currentUser) {
      setView('login');
      return;
    }
    
    const updatedFavorites = currentUser.favorites.includes(toolId)
      ? currentUser.favorites.filter(id => id !== toolId)
      : [...currentUser.favorites, toolId];
      
    const updatedUser = { ...currentUser, favorites: updatedFavorites };
    setCurrentUser(updatedUser);

    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, { 
        favorites: updatedFavorites,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-brand-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg text-white font-sans overflow-x-hidden">
      {/* Background Grid & Particles */}
      <div className="fixed inset-0 grid-overlay opacity-20 pointer-events-none"></div>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-primary rounded-full blur-[120px] opacity-20"
        ></motion.div>
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 15, repeat: Infinity }}
          className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-brand-secondary rounded-full blur-[150px] opacity-20"
        ></motion.div>
      </div>

      {/* Navigation */}
      <motion.nav 
        style={{ backgroundColor: navBg }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 backdrop-blur-xl"
      >
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setActiveTool(null); setAiOutput(''); }}>
            <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center text-white font-bold shadow-[0_0_20px_rgba(108,99,255,0.4)] group-hover:rotate-12 transition-transform">D</div>
            <span className="font-display font-bold text-2xl tracking-tighter">DILLAAS <span className="text-brand-secondary">AI</span></span>
          </div>

          <div className="flex items-center gap-6">
             <div className="hidden sm:flex items-center gap-2 px-4 py-1.5 glass rounded-full border border-brand-primary/20">
               <Zap className="w-3 h-3 text-brand-secondary fill-brand-secondary" />
               <span className="text-[10px] font-bold uppercase tracking-[0.2em] leading-none">Unlimited Access</span>
             </div>
             
             <div className="flex items-center gap-4">
                {currentUser ? (
                  <div className="flex items-center gap-4">
                    {currentUser.isAdmin && (
                      <button 
                        onClick={() => setView('admin')}
                        className="text-xs font-bold uppercase tracking-widest text-brand-accent hover:text-white transition-colors"
                      >
                        Admin
                      </button>
                    )}
                    <button 
                      onClick={() => setView('dashboard')}
                      className="text-xs font-bold uppercase tracking-widest text-[#a0a0b0] hover:text-white transition-colors"
                    >
                      Dashboard
                    </button>
                    <button 
                      onClick={handleLogout}
                      className="w-10 h-10 glass rounded-xl flex items-center justify-center text-brand-accent border border-brand-accent/20 hover:bg-brand-accent/10 transition-colors"
                    >
                      <LogOut className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setView('login')}
                    className="px-6 py-2 rounded-xl bg-brand-primary text-sm font-bold shadow-[0_0_20px_rgba(108,99,255,0.3)] hover:shadow-[0_0_30px_rgba(108,99,255,0.5)] transition-all flex items-center gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    Login
                  </motion.button>
                )}
             </div>
          </div>
        </div>
      </motion.nav>

      <main>
        {view === 'home' && (
          <>
            {/* Hero Section */}
            <section className="relative min-h-[90vh] flex items-center pt-20">
          <div className="max-w-7xl mx-auto px-4 w-full grid lg:grid-cols-2 gap-12 items-center relative z-10">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-[10px] font-bold uppercase tracking-widest mb-8">
                <Sparkles className="w-3 h-3" />
                The Future of Sri Lankan AI
              </div>
              <h1 className="text-6xl md:text-8xl font-display font-bold leading-[0.9] tracking-tighter mb-8 italic">
                CRAFTING <br />
                <span className="text-gradient">INTELLIGENCE</span> <br />
                WITHOUT LIMITS.
              </h1>
              <p className="text-lg text-brand-text mb-12 max-w-lg leading-relaxed">
                DILLAAS AI delivers production-grade creative tools for everyone. 
                Experience the next generation of automation, writing, and guidance 100% free.
              </p>

              <div className="flex flex-wrap gap-4 mb-16">
                <motion.button 
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 rounded-2xl bg-brand-primary font-bold shadow-[0_0_30px_rgba(108,99,255,0.4)] animate-pulse-glow flex items-center gap-3 group"
                >
                  Get Started Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </motion.button>
                <button className="px-8 py-4 rounded-2xl glass font-bold hover:bg-white/10 transition-colors border border-white/10">
                  Explore Tools
                </button>
              </div>

              <div className="flex items-center gap-8 text-white/40">
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-white tracking-tighter">∞</span>
                  <span className="text-[10px] uppercase tracking-widest font-bold">Free Usage</span>
                </div>
                <div className="w-px h-8 bg-white/10"></div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-white tracking-tighter">0.1s</span>
                  <span className="text-[10px] uppercase tracking-widest font-bold">Latency</span>
                </div>
                <div className="w-px h-8 bg-white/10"></div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-white tracking-tighter">8+</span>
                  <span className="text-[10px] uppercase tracking-widest font-bold">Main Tools</span>
                </div>
              </div>
            </motion.div>

            <div className="relative hidden lg:block">
              <motion.div 
                animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="w-full aspect-square glass-dark rounded-[60px] border border-white/10 flex items-center justify-center relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-brand-primary/10 to-brand-secondary/10"></div>
                <div className="relative z-10 w-4/5 h-4/5 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 rounded-xl bg-brand-secondary/20 flex items-center justify-center">
                      <Cpu className="w-6 h-6 text-brand-secondary" />
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-white/40 uppercase tracking-widest font-bold mb-1">Processing</div>
                      <div className="text-2xl font-display font-bold tracking-tighter">ULTRA-FAST</div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: "70%" }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="h-full bg-brand-primary shadow-[0_0_15px_rgba(108,99,255,1)]"
                      ></motion.div>
                    </div>
                    <div className="h-2 w-3/4 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: "90%" }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                        className="h-full bg-brand-secondary shadow-[0_0_15px_rgba(0,212,255,1)]"
                      ></motion.div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 py-8 border-y border-white/5">
                    <div className="flex -space-x-4">
                      {[1,2,3].map(i => (
                        <div key={i} className="w-10 h-10 rounded-full border-2 border-brand-bg bg-gray-800 flex items-center justify-center text-xs font-bold">
                          {i === 3 ? '+' : 'U'}
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="text-xs font-bold tracking-widest uppercase">Community Driven</div>
                      <div className="text-[10px] text-white/40">Join 10k+ Sri Lankan Creators</div>
                    </div>
                  </div>

                  <div className="flex justify-between items-end italic">
                    <span className="text-xs font-bold text-brand-accent tracking-widest uppercase">DILLAAS AI v3</span>
                    <span className="text-xs font-bold text-white/20">EST. 2026</span>
                  </div>
                </div>
              </motion.div>
              
              {/* Floating 3D Elements */}
              <motion.div 
                animate={{ y: [0, 20, 0] }}
                transition={{ duration: 4, repeat: Infinity, delay: 1 }}
                className="absolute -top-10 -left-10 w-24 h-24 glass rounded-3xl flex items-center justify-center border border-brand-primary/30 rotate-12 shadow-2xl"
              >
                <Star className="w-10 h-10 text-brand-primary fill-brand-primary" />
              </motion.div>
              <motion.div 
                animate={{ y: [0, -30, 0] }}
                transition={{ duration: 5, repeat: Infinity, delay: 0.5 }}
                className="absolute -bottom-10 -right-5 w-32 h-16 glass rounded-2xl flex items-center justify-center border border-brand-secondary/30 -rotate-6 shadow-2xl"
              >
                <div className="flex gap-1">
                   <div className="w-2 h-2 rounded-full bg-brand-secondary"></div>
                   <div className="w-2 h-2 rounded-full bg-brand-secondary opacity-50"></div>
                   <div className="w-2 h-2 rounded-full bg-brand-secondary opacity-20"></div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Tools Section */}
        <section id="tools" className="max-w-7xl mx-auto px-4 py-32">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-display font-bold tracking-tighter mb-4 italic">FORGE <span className="text-brand-secondary">BEYOND</span> LIMITS.</h2>
            <div className="w-24 h-1 bg-brand-primary mx-auto mb-8 rounded-full"></div>
            
            <div className="max-w-xl mx-auto relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-text group-focus-within:text-brand-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Search tools (e.g. Sinhala, Translator, CV...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-5 bg-white/5 rounded-3xl border border-white/5 focus:bg-white/10 focus:border-brand-primary/30 transition-all outline-none text-sm font-medium tracking-wide"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTools.map((tool, index) => {
              const Icon = IconMap[tool.icon] || Sparkles;
              return (
                <motion.div
                  key={tool.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => {
                     setActiveTool(tool);
                     setAiOutput('');
                     setUserInput('');
                  }}
                  className="p-10 glass-dark rounded-[48px] cursor-pointer neon-border transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-2xl group-hover:bg-brand-primary/10 transition-colors"></div>
                  
                  <button 
                    onClick={(e) => toggleFavorite(e, tool.id)}
                    className={cn(
                      "absolute top-8 right-8 p-3 rounded-xl glass border transition-all z-20",
                      currentUser?.favorites.includes(tool.id) 
                        ? "text-brand-accent border-brand-accent/30 bg-brand-accent/5" 
                        : "text-white/20 border-white/5 hover:text-white"
                    )}
                  >
                    <Heart className={cn("w-4 h-4 transition-transform", currentUser?.favorites.includes(tool.id) && "fill-brand-accent scale-110")} />
                  </button>
                  
                  <div className={cn(
                    "w-16 h-16 rounded-[22px] flex items-center justify-center mb-8 transition-all duration-500",
                    "bg-white/5 group-hover:bg-brand-primary text-brand-primary group-hover:text-white group-hover:scale-110 group-hover:rotate-12 shadow-[inset_0_0_10px_rgba(255,255,255,0.05)]"
                  )}>
                    <Icon className="w-8 h-8" />
                  </div>
                  
                  <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-text mb-2 flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-brand-secondary"></div>
                    {tool.category}
                  </div>
                  <h3 className="font-display font-bold text-2xl mb-4 tracking-tight tracking-wide group-hover:text-brand-secondary transition-colors">{tool.name}</h3>
                  <p className="text-sm text-white/50 leading-relaxed mb-8">{tool.description}</p>
                  
                  <div className="flex items-center gap-2 text-xs font-bold text-brand-primary">
                    <span className="group-hover:translate-x-1 transition-transform inline-flex items-center gap-2">
                      Access Now <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
          
          {filteredTools.length === 0 && (
            <div className="py-20 text-center glass rounded-[40px] border-dashed border-white/10">
              <p className="text-white/40 font-medium tracking-widest text-sm italic">NO NEURAL PATHS FOUND MATCHING "{searchQuery}"</p>
            </div>
          )}
        </section>
      </>
    )}
        
        {view === 'login' && (
          <section className="min-h-[90vh] flex items-center justify-center pt-20 px-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md w-full glass-dark p-8 md:p-12 rounded-[48px] border border-white/5 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 rounded-full blur-3xl"></div>
              
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-brand-primary rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-6 shadow-[0_0_20px_rgba(108,99,255,0.4)]">D</div>
                <h2 className="text-3xl font-display font-bold tracking-tighter mb-2 italic">
                  WELCOME TO <span className="text-brand-secondary">DILLAAS</span>
                </h2>
                <p className="text-sm text-brand-text">The next generation of Sri Lankan intelligence.</p>
              </div>

              <form onSubmit={handleAuth} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Email Address</label>
                  <input 
                    type="email" 
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full px-6 py-4 bg-white/5 rounded-2xl border border-white/5 focus:border-brand-primary/30 outline-none text-sm transition-all"
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Password</label>
                  <input 
                    type="password" 
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full px-6 py-4 bg-white/5 rounded-2xl border border-white/5 focus:border-brand-primary/30 outline-none text-sm transition-all"
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex items-center gap-3">
                   <input type="checkbox" id="remember" className="w-4 h-4 rounded border-white/10 bg-white/5 text-brand-primary focus:ring-brand-primary" />
                   <label htmlFor="remember" className="text-xs text-brand-text font-bold">Remember me for 30 cycles</label>
                </div>

                {authError && <p className="text-xs text-brand-accent font-bold tracking-widest text-center">{authError.toUpperCase()}</p>}

                <button className="w-full py-4 bg-brand-primary rounded-2xl font-bold shadow-[0_0_20px_rgba(108,99,255,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all">
                  {isSignUp ? 'Create Neural Account' : 'Initialize Connection'}
                </button>
              </form>

              <div className="mt-8 pt-8 border-t border-white/5 flex flex-col gap-4">
                <button 
                  onClick={handleGoogleLogin}
                  type="button"
                  className="w-full py-4 glass rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-white/10 transition-all border border-white/10"
                >
                  <Globe className="w-4 h-4 text-brand-secondary" />
                  Continue with Google
                </button>
                <button 
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-xs font-bold text-brand-text hover:text-white transition-colors text-center"
                >
                  {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </button>
                <button 
                  onClick={() => setView('home')}
                  className="text-xs font-bold text-white/20 hover:text-white transition-colors text-center"
                >
                  Continue as Guest
                </button>
              </div>
            </motion.div>
          </section>
        )}

        {view === 'dashboard' && currentUser && (
          <section className="max-w-7xl mx-auto px-4 py-32">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid lg:grid-cols-3 gap-8"
            >
              <div className="lg:col-span-1 space-y-8">
                <div className="glass-dark p-10 rounded-[48px] border border-white/5 relative overflow-hidden">
                   <div className="w-20 h-20 bg-brand-primary rounded-3xl flex items-center justify-center text-3xl font-bold mb-6">
                     {currentUser.name[0].toUpperCase()}
                   </div>
                   <h2 className="text-3xl font-display font-bold tracking-tighter mb-2 italic">{currentUser.name}</h2>
                   <p className="text-brand-text text-sm mb-8">{currentUser.email}</p>
                   
                   <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 glass rounded-2xl border border-white/5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Node Active At</span>
                        <span className="text-xs font-bold">{new Date(currentUser.lastActive).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 glass rounded-2xl border border-white/5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Neural ID</span>
                        <span className="text-xs font-bold">#{currentUser.id}</span>
                      </div>
                   </div>
                </div>
              </div>

              <div className="lg:col-span-2 grid md:grid-cols-2 gap-8 h-fit">
                <div className="glass-dark p-10 rounded-[48px] border border-white/5 shadow-2xl transition-all hover:bg-brand-primary/5">
                   <div className="w-12 h-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center mb-6">
                     <Layers className="w-6 h-6 text-brand-primary" />
                   </div>
                   <div className="text-4xl font-display font-bold tracking-tighter mb-2 italic">{currentUser.toolsUsed}</div>
                   <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-text">Generations Performed</div>
                </div>
                <div className="glass-dark p-10 rounded-[48px] border border-white/5 shadow-2xl transition-all hover:bg-brand-secondary/5">
                   <div className="w-12 h-12 bg-brand-secondary/10 rounded-2xl flex items-center justify-center mb-6">
                     <Star className="w-6 h-6 text-brand-secondary" />
                   </div>
                   <div className="text-4xl font-display font-bold tracking-tighter mb-2 italic">{new Date(currentUser.joinDate).toLocaleDateString()}</div>
                   <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-text">Join Date</div>
                </div>
                
                <div className="md:col-span-2 glass-dark p-10 rounded-[48px] border border-white/5">
                   <h3 className="text-xl font-display font-bold tracking-tighter mb-6 italic flex items-center gap-3">
                     <Star className="w-5 h-5 text-brand-accent" />
                     YOUR FAVORITES
                   </h3>
                   <div className="grid sm:grid-cols-2 gap-4">
                      {currentUser.favorites.length > 0 ? (
                        TOOLS.filter(t => currentUser.favorites.includes(t.id)).map(t => (
                          <div key={t.id} onClick={() => { setView('home'); setActiveTool(t); }} className="p-6 glass rounded-3xl border border-white/5 hover:border-brand-primary/30 transition-all cursor-pointer group">
                             <h4 className="font-bold text-sm mb-1 group-hover:text-brand-primary transition-colors">{t.name}</h4>
                             <p className="text-[10px] text-brand-text uppercase tracking-widest">{t.category}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-white/20 italic">No neural links saved yet.</p>
                      )}
                   </div>
                </div>
                
                <div className="md:col-span-2 glass-dark p-10 rounded-[48px] border border-white/5">
                   <h3 className="text-xl font-display font-bold tracking-tighter mb-6 italic flex items-center gap-3">
                     <Layout className="w-5 h-5 text-brand-primary" />
                     RECOMMENDED TOOLS
                   </h3>
                   <div className="grid sm:grid-cols-2 gap-4">
                      {TOOLS.slice(0, 4).map(t => (
                        <div key={t.id} onClick={() => { setView('home'); setActiveTool(t); }} className="p-6 glass rounded-3xl border border-white/5 hover:border-brand-primary/30 transition-all cursor-pointer group">
                           <h4 className="font-bold text-sm mb-1 group-hover:text-brand-primary transition-colors">{t.name}</h4>
                           <p className="text-[10px] text-brand-text uppercase tracking-widest">{t.category}</p>
                        </div>
                      ))}
                   </div>
                </div>
              </div>
            </motion.div>
          </section>
        )}

        {view === 'admin' && currentUser?.isAdmin && (
          <section className="max-w-7xl mx-auto px-4 py-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-16">
              <div>
                <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tighter mb-2 italic">Neural <span className="text-brand-accent">Control</span> Panel</h2>
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-brand-text">
                   <Shield className="w-4 h-4 text-brand-accent" />
                   DILLAAS Global Overseer Mode
                </div>
              </div>
              <button 
                onClick={exportUsersCSV}
                className="flex items-center gap-3 px-8 py-4 glass rounded-2xl border border-white/10 hover:bg-white/10 transition-all font-bold text-xs uppercase tracking-widest"
              >
                <Download className="w-4 h-4" />
                Export Core CSV
              </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
               {[
                 { label: 'Total Biological Assets', val: adminUsers.length, icon: Users, color: '#6c63ff' },
                 { label: 'Daily Neural Activity', val: adminLogs.length, icon: BarChart, color: '#00d4ff' },
                 { label: 'System Uptime', val: '99.98%', icon: Settings, color: '#ff6b6b' },
               ].map((stat, i) => (
                 <div key={i} className="glass-dark p-10 rounded-[48px] border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                    <stat.icon className="w-8 h-8 mb-6" style={{ color: stat.color }} />
                    <div className="text-5xl font-display font-bold tracking-tighter mb-2 italic group-hover:scale-110 transition-transform origin-left">{stat.val}</div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-text">{stat.label}</div>
                 </div>
               ))}
            </div>

            {/* Top Tools & Recent Activity */}
            <div className="grid md:grid-cols-2 gap-8 mb-16">
               <div className="glass-dark p-10 rounded-[48px] border border-white/5">
                  <h3 className="font-display font-bold tracking-tighter uppercase italic text-xs mb-8 flex items-center gap-3">
                    <Zap className="w-4 h-4 text-brand-secondary" />
                    Popular Neural Modules
                  </h3>
                    <div className="space-y-6">
                    {Object.entries(
                      adminLogs.reduce((acc, log) => {
                        acc[log.toolId] = (acc[log.toolId] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    )
                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                    .slice(0, 5)
                    .map(([id, count]) => {
                      const tool = TOOLS.find(t => t.id === id);
                      return (
                        <div key={id} className="flex justify-between items-center group">
                          <div>
                            <div className="text-sm font-bold group-hover:text-brand-secondary transition-colors">{tool ? tool.name : id}</div>
                            <div className="text-[9px] text-white/30 uppercase tracking-widest">{id}</div>
                          </div>
                          <div className="text-xl font-display font-bold italic text-brand-secondary">{count as number}</div>
                        </div>
                      );
                    })}
                  </div>
               </div>
               
               <div className="glass-dark p-10 rounded-[48px] border border-white/5">
                  <h3 className="font-display font-bold tracking-tighter uppercase italic text-xs mb-8 flex items-center gap-3">
                    <Sparkles className="w-4 h-4 text-brand-primary" />
                    System Pulse
                  </h3>
                  <div className="space-y-4">
                     <p className="text-xs text-brand-text leading-relaxed">
                       DILLAAS AI core is processing at optimal capacity. All neural nodes reporting stable connection.
                       Latency monitored at 84ms average for South Asian nodes.
                     </p>
                     <div className="pt-4 flex items-center gap-6">
                        <div className="flex flex-col">
                           <span className="text-xl font-display font-bold">12.1k</span>
                           <span className="text-[8px] font-bold uppercase tracking-widest text-white/20">Tokens/Min</span>
                        </div>
                        <div className="flex flex-col">
                           <span className="text-xl font-display font-bold"> Lanka-1</span>
                           <span className="text-[8px] font-bold uppercase tracking-widest text-white/20">Primary Cluster</span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            {/* Users Table */}
            <div className="glass-dark rounded-[48px] border border-white/5 overflow-hidden">
               <div className="p-8 border-b border-white/5 bg-white/5">
                  <h3 className="font-display font-bold tracking-tighter uppercase italic text-xs">Registered Nodes Repository</h3>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-[9px] font-bold uppercase tracking-[0.4em] text-white/30">
                        <th className="px-8 py-6">Identity</th>
                        <th className="px-8 py-6">Initialized</th>
                        <th className="px-8 py-6">Last Ping</th>
                        <th className="px-8 py-6">Operations</th>
                        <th className="px-8 py-6">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers.map((u, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                          <td className="px-8 py-6">
                            <div className="font-bold text-sm">{u.name}</div>
                            <div className="text-xs text-white/40">{u.email}</div>
                          </td>
                          <td className="px-8 py-6 text-xs text-brand-text">{new Date(u.joinDate).toLocaleDateString()}</td>
                          <td className="px-8 py-6 text-xs text-brand-text">{new Date(u.lastActive).toLocaleDateString()}</td>
                          <td className="px-8 py-6 font-display font-bold italic">{u.toolsUsed}</td>
                          <td className="px-8 py-6">
                            <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-[8px] font-bold uppercase tracking-widest border border-green-500/20">Active</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            </div>
          </section>
        )}
      </main>

      {/* Tool Workspace - Fixed Full Screen */}
      <AnimatePresence>
        {activeTool && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[70] bg-brand-bg/95 backdrop-blur-3xl overflow-y-auto"
          >
             <div className="fixed inset-0 grid-overlay opacity-20 pointer-events-none"></div>
             
             <div className="max-w-5xl mx-auto px-4 py-12 md:py-24 relative z-10">
              {/* Tool Header */}
              <div className="flex items-start justify-between mb-16 px-4">
                <div className="flex items-center gap-8">
                  <motion.div 
                    initial={{ rotate: -20, scale: 0 }}
                    animate={{ rotate: 0, scale: 1 }}
                    className="w-20 h-20 bg-brand-primary text-white rounded-[32px] flex items-center justify-center shadow-[0_0_40px_rgba(108,99,255,0.4)]"
                  >
                    {React.createElement(IconMap[activeTool.icon] || Sparkles, { className: "w-10 h-10" })}
                  </motion.div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-secondary">{activeTool.category}</span>
                      <span className="px-2 py-0.5 bg-brand-accent/20 text-brand-accent text-[8px] font-bold uppercase rounded tracking-widest">Active Tool</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tighter leading-tight italic">{activeTool.name}</h2>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveTool(null)}
                  className="w-14 h-14 glass rounded-full flex items-center justify-center border border-white/10 hover:bg-white/20 transition-all hover:scale-110 active:scale-90"
                >
                  <X className="w-8 h-8" />
                </button>
              </div>

              {/* Tool Interface */}
              <div className="grid gap-12">
                <motion.div 
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="glass-dark p-10 md:p-14 rounded-[60px] border border-white/5 relative"
                >
                   <div className="absolute top-10 left-10 w-px h-10 bg-brand-primary/50"></div>
                   
                   {activeTool.id === 'life-coach' && (
                     <div className="mb-12">
                       <label className="block text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 mb-6">Select Life Path</label>
                       <div className="flex flex-wrap gap-3">
                         {[
                           'Discipline & Habits', 
                           'Study & Practice', 
                           'Stress & Mental health', 
                           'Family Problems', 
                           'Brain Boosting', 
                           'General Problems'
                         ].map(cat => (
                           <button
                             key={cat}
                             onClick={() => setCoachCategory(cat)}
                             className={cn(
                               "px-6 py-3 rounded-2xl text-[10px] font-bold transition-all border uppercase tracking-widest",
                               coachCategory === cat 
                                 ? "bg-brand-primary text-white border-brand-primary shadow-[0_0_20px_rgba(108,99,255,0.4)]" 
                                 : "bg-white/5 text-white/60 border-white/5 hover:border-white/20"
                             )}
                           >
                             {cat}
                           </button>
                         ))}
                       </div>
                     </div>
                   )}
                   
                   <label className="block text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 mb-6">
                     {activeTool.id === 'life-coach' ? 'Describe your challenge...' : 'Technical Input'}
                   </label>
                   
                   <textarea 
                     value={userInput}
                     onChange={(e) => setUserInput(e.target.value)}
                     placeholder={activeTool.id === 'life-coach' ? "ඔබේ ගැටළුව මෙහි ලියන්න... (Describe your problem in Singlish or English)" : "Enter context, technical requirements or your creative idea..."}
                     className="w-full h-56 bg-brand-bg/50 p-8 rounded-[40px] border border-white/5 focus:border-brand-primary/30 transition-all resize-none font-sans text-xl placeholder:text-white/10 outline-none leading-relaxed shadow-inner"
                   />
                   
                   <div className="mt-10 flex flex-col md:flex-row justify-between items-center gap-6">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#a0a0b0]">
                        <Layers className="w-3 h-3" />
                        Multilingual Processing Active
                      </div>
                      <motion.button 
                        disabled={generating || !userInput.trim()}
                        onClick={handleRunTool}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-full md:w-auto bg-brand-primary text-white px-12 py-5 rounded-[28px] font-bold flex items-center justify-center gap-4 disabled:opacity-50 shadow-[0_0_40px_rgba(108,99,255,0.3)] transition-all group"
                      >
                        {generating ? (
                          <>
                            <Loader2 className="w-6 h-6 animate-spin" />
                            DILLAAS is thinking...
                          </>
                        ) : (
                          <>
                            Generate Content
                            <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                          </>
                        )}
                      </motion.button>
                   </div>
                </motion.div>

                {/* Result Section */}
                {aiOutput && (
                  <motion.div 
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-dark p-12 md:p-20 rounded-[60px] border border-brand-primary/10 relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-primary to-transparent opacity-50"></div>
                    
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-full bg-brand-primary/20 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-brand-primary" />
                         </div>
                         <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-brand-secondary">Generation Success</label>
                      </div>
                      <button 
                        onClick={handleCopy}
                        className="flex items-center gap-3 px-6 py-3 bg-white/5 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5 active:scale-95"
                      >
                        {copied ? <Check className="w-4 h-4 text-brand-secondary" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied to Clipboard' : 'Copy Response'}
                      </button>
                    </div>
                    
                    <div className="prose prose-invert prose-lg max-w-none prose-headings:font-display prose-headings:tracking-tighter prose-p:text-brand-text prose-p:leading-[1.8] text-white/90 selection:bg-brand-secondary/30">
                      <Markdown>{aiOutput}</Markdown>
                    </div>
                    
                    <div className="mt-16 pt-12 border-t border-white/5 flex justify-between items-center italic">
                       <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">DILLAAS AI CORE v3.2</span>
                       <div className="flex gap-2">
                          <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></div>
                          <div className="w-2 h-2 rounded-full bg-brand-secondary animate-pulse [animation-delay:0.2s]"></div>
                          <div className="w-2 h-2 rounded-full bg-brand-accent animate-pulse [animation-delay:0.4s]"></div>
                       </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="relative bg-brand-bg/50 border-t border-white/5 py-24 px-4 mt-32 text-center overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-px bg-gradient-to-r from-transparent via-brand-primary/50 to-transparent"></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
           <div className="flex flex-col items-center gap-6 mb-16">
            <div className="w-14 h-14 bg-brand-primary rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-[0_0_30px_rgba(108,99,255,0.3)]">D</div>
            <span className="font-display font-bold text-4xl tracking-tighter">DILLAAS <span className="text-brand-secondary">AI</span></span>
            <p className="text-brand-text max-w-md text-sm leading-relaxed">
              Leading the Sri Lankan AI revolution. High-fidelity creative tools designed for high-performance minds. 
            </p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-x-16 gap-y-8 text-[11px] font-bold uppercase tracking-[0.4em] text-white/30 mb-16">
            <a href="#" className="hover:text-brand-primary transition-colors">Neural Assets</a>
            <a href="#" className="hover:text-brand-secondary transition-colors">Core Protocols</a>
            <a href="#" className="hover:text-brand-accent transition-colors">Safety Specs</a>
            <a href="#" className="hover:text-brand-primary transition-colors">Repository</a>
          </div>
          
          <div className="inline-flex items-center gap-4 px-6 py-2 glass rounded-full border border-white/10 text-[9px] font-bold uppercase tracking-widest text-white/40">
             <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,1)]"></div>
             System Status: Nominal
          </div>
          
          <p className="mt-12 text-[10px] text-white/20 font-bold tracking-[0.2em]">© 2026 DILLAAS AI. Free forever. Built for the Future.</p>
        </div>
      </footer>
    </div>
  );
}
