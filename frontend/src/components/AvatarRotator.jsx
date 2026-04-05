
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const avatars = ["/avatars/1.png","/avatars/2.png","/avatars/3.png","/avatars/4.png","/avatars/5.png","/avatars/6.png"];

export default function AvatarRotator({ className = "" }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(p => (p+1)%avatars.length), 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <AnimatePresence mode="wait">
      <motion.img key={avatars[i]} src={avatars[i]} className={`object-contain ${className}`}
        initial={{opacity:0, y:10, scale:0.94, rotate:-1.2}} animate={{opacity:1, y:0, scale:1, rotate:0}} exit={{opacity:0, y:-10, scale:0.96, rotate:1.2}}
        transition={{duration:0.62, ease:[0.22, 1, 0.36, 1]}}
      />
    </AnimatePresence>
  );
}
