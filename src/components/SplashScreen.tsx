import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/logo-entityiq-v7.png";

interface SplashScreenProps {
  duration?: number;
}

const SplashScreen = ({ duration = 5000 }: SplashScreenProps) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
        >
          <motion.img
            src={logo}
            alt="entityIQ"
            className="h-20 mb-6"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          <motion.div
            className="h-0.5 rounded-full bg-primary/30 overflow-hidden"
            style={{ width: 200 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: (duration - 800) / 1000, ease: "easeInOut", delay: 0.5 }}
            />
          </motion.div>
          <motion.p
            className="mt-4 text-xs text-muted-foreground tracking-widest uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            Loading
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
