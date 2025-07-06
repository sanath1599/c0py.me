/* ------------------------------------------------------------------
   LandingPage.tsx  ▸  glass-style hero & features
   ------------------------------------------------------------------ */

   import React, { useState } from 'react';
   import { motion } from 'framer-motion';
   import {
     ArrowRight,
     ShieldCheck,
     UserCheck,
     Zap,
     Globe,
     Key,
     Sparkles,
     UploadCloud,
     Play,
   } from 'lucide-react';
   import { GlassCard } from '../components/GlassCard';
   import { DemoModal } from '../components/DemoModal';
   
   /* ---------------------------- helpers ---------------------------- */
   
   const fadeUp = (delay = 0) => ({
     initial: { opacity: 0, y: 30 },
     animate: { opacity: 1, y: 0 },
     transition: { duration: 0.8, delay },
   });
   
   /* ------------------------- component ----------------------------- */
   
   interface LandingPageProps {
     onGetStarted: () => void;
   }
   
   export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
     const [showDemo, setShowDemo] = useState(false);

     return (
       <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
         {/* radial background */}
         <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-50 via-white to-white" />
   
         {/* floating blurred blobs */}
         <motion.div
           className="absolute w-96 h-96 bg-orange-400/20 rounded-full blur-3xl -top-24 -left-32"
           animate={{ y: [0, 40, 0] }}
           transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
         />
         <motion.div
           className="absolute w-96 h-96 bg-orange-400/20 rounded-full blur-3xl -bottom-24 -right-32"
           animate={{ y: [0, -40, 0] }}
           transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
         />
   
         <div className="max-w-6xl w-full">
           {/* ---------------- HERO ---------------- */}
           <motion.div className="text-center mb-20" {...fadeUp()}>
             {/* logo and Product Hunt badge */}
             <motion.div className="mb-8" {...fadeUp(0.2)}>
               <div className="w-44 h-44 mx-auto flex items-center justify-center rounded-full backdrop-blur-xl bg-white/40 ring-1 ring-white/60 shadow-lg mb-6">
                 <img src="/logo.png" alt="c0py.me" className="w-36 h-36 select-none" />
               </div>
               
               {/* Product Hunt Badge */}
               <div className="flex justify-center">
                 <a 
                   href="https://www.producthunt.com/products/c0py-me?embed=true&utm_source=badge-featured&utm_medium=badge&utm_source=badge-c0py&#0045;me&#0045;2" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="inline-block transition-transform hover:scale-105"
                 >
                   <img 
                     src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=989111&theme=light&t=1751830203700" 
                     alt="c0py.me - Secure, anonymous p2p file sharing | Product Hunt" 
                     style={{ width: '250px', height: '54px' }} 
                     width="250" 
                     height="54" 
                   />
                 </a>
               </div>
             </motion.div>
   
             {/* heading */}
             <motion.h1
               className="text-6xl md:text-7xl font-extrabold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-orange-600 via-orange-500 to-amber-400"
               {...fadeUp(0.4)}
             >
               c0py.me
             </motion.h1>
   
             {/* tagline */}
             <motion.p
               className="text-2xl md:text-3xl text-neutral-800/80 mb-3"
               {...fadeUp(0.55)}
             >
               Private&nbsp;•&nbsp;P2P&nbsp;•&nbsp;Instant
             </motion.p>
   
             <motion.p
               className="text-lg md:text-xl text-orange-700/90 mb-12"
               {...fadeUp(0.7)}
             >
               Share anything between your devices&nbsp;— zero servers, zero traces
             </motion.p>
   
             {/* CTA Buttons */}
             <motion.div className="flex flex-col sm:flex-row gap-4 justify-center items-center" {...fadeUp(0.85)}>
               <motion.button
                 onClick={onGetStarted}
                 className="inline-flex items-center gap-3 px-10 py-5 text-lg md:text-xl font-bold rounded-2xl backdrop-blur-xl bg-white/30 ring-1 ring-white/60 shadow-xl transition-transform hover:scale-105 active:scale-95"
                 style={{
                   background:
                     'linear-gradient(135deg,rgba(246,193,72,0.75) 0%,rgba(166,82,27,0.85) 100%)',
                 }}
               >
                 <Sparkles size={24} />
                 Start Sharing
                 <ArrowRight size={24} />
               </motion.button>
   
               <motion.button
                 onClick={() => setShowDemo(true)}
                 className="inline-flex items-center gap-3 px-8 py-5 text-lg md:text-xl font-bold rounded-2xl backdrop-blur-xl bg-white/20 ring-1 ring-white/40 shadow-xl transition-transform hover:scale-105 active:scale-95 hover:bg-white/30"
               >
                 <Play size={24} />
                 Watch Demo
               </motion.button>
             </motion.div>
           </motion.div>
   
           {/* ---------------- FEATURES ---------------- */}
           <motion.div
             className="grid md:grid-cols-2 lg:grid-cols-3 gap-10 mb-24"
             {...fadeUp(1)}
           >
             {FEATURES.map((f, i) => (
               <FeatureCard key={f.title} {...f} delay={1 + i * 0.1} />
             ))}
           </motion.div>
   
           {/* ---------------- HOW IT WORKS ---------------- */}
           <motion.div className="mb-24" {...fadeUp(1.3)}>
             <h2 className="text-4xl md:text-5xl font-bold text-center mb-14 text-neutral-800">
               How It Works
             </h2>
   
             <div className="grid md:grid-cols-3 gap-10">
               {STEPS.map((s, i) => (
                 <motion.div
                   key={s.title}
                   className="text-center flex flex-col items-center gap-4"
                   {...fadeUp(1.35 + i * 0.1)}
                 >
                   <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 text-white text-2xl font-bold flex items-center justify-center shadow-lg">
                     {i + 1}
                   </div>
                   <h3 className="text-xl font-semibold text-neutral-800">
                     {s.title}
                   </h3>
                   <p className="text-lg text-neutral-700/80 max-w-xs">{s.body}</p>
                 </motion.div>
               ))}
             </div>
           </motion.div>
   
           {/* ---------------- FOOTER ---------------- */}
           <motion.footer className="text-center space-y-6 pb-10" {...fadeUp(1.8)}>
             <p className="text-lg text-neutral-700/70">
               Open-source • React 18 • WebRTC • Socket.IO • TypeScript
             </p>

             <a
               href="https://www.linkedin.com/in/sanathswaroop/"
               target="_blank"
               rel="noopener noreferrer"
               className="inline-flex items-center gap-2 px-5 py-2 rounded-full backdrop-blur-md bg-white/40 ring-1 ring-white/60 shadow hover:bg-orange-100/40 transition-colors text-sm font-medium text-orange-700"
             >
               Made&nbsp;with <span className="text-red-500">♥</span> by Sanath
             </a>
           </motion.footer>
         </div>

         {/* Demo Modal */}
         <DemoModal isOpen={showDemo} onClose={() => setShowDemo(false)} />
       </div>
     );
   };
   
   /* ---------------- data & sub-components ---------------- */
   
   interface Feature {
     icon: React.ReactNode;
     title: string;
     body: string;
   }
   
   const FEATURES: Feature[] = [
     {
       icon: <ShieldCheck size={28} />,
       title: 'Secure P2P Transfer',
       body: 'Files travel directly between devices using WebRTC. No servers store or access your data.',
     },
     {
       icon: <UserCheck size={28} />,
       title: 'Anonymous Sharing',
       body: 'Generate random usernames, no accounts required. Share files without revealing your identity.',
     },
     {
       icon: <Zap size={28} />,
       title: 'Lightning Fast',
       body: 'Direct device-to-device transfers eliminate server bottlenecks. Experience maximum transfer speeds.',
     },
     {
       icon: <Globe size={28} />,
       title: 'Three Worlds',
       body: 'Jungle (global), Room (private codes), or Family (same WiFi). Choose your sharing environment.',
     },
     {
       icon: <Key size={28} />,
       title: 'Connection Authorization',
       body: 'Recipients see file details and approve transfers. No surprise file downloads.',
     },
     {
       icon: <UploadCloud size={28} />,
       title: 'Real-time Progress',
       body: 'Watch animated cubs track transfer progress with live speed and time estimates.',
     },
   ];
   
       const STEPS = [
      {
        title: 'Choose Your World',
        body: 'Join the global Jungle, create private Rooms with codes, or connect with Family on the same WiFi network.',
      },
      {
        title: 'Select & Send Request',
        body: 'Pick your files, choose a recipient, and send a connection request. They\'ll see your file details and can accept or decline.',
      },
      {
        title: 'Direct P2P Transfer',
        body: 'Once accepted, files transfer directly between devices via WebRTC. Watch the animated cub track progress in real-time.',
      },
    ];
   
   const FeatureCard: React.FC<Feature & { delay: number }> = ({
     icon,
     title,
     body,
     delay,
   }) => (
     <motion.div {...fadeUp(delay)}>
       <GlassCard className="p-8 text-center group transition-transform hover:scale-[1.03]">
         <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg text-white">
           {icon}
         </div>
         <h3 className="text-2xl font-semibold mb-3 text-neutral-800">{title}</h3>
         <p className="text-lg leading-relaxed text-neutral-700/80">{body}</p>
       </GlassCard>
     </motion.div>
   );
   