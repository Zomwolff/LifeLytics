
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const avatars = ["/avatars/1.png","/avatars/2.png","/avatars/3.png","/avatars/4.png","/avatars/5.png","/avatars/6.png"];

export default function AvatarRotator() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(p => (p+1)%avatars.length), 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <AnimatePresence mode="wait">
      <motion.img key={avatars[i]} src={avatars[i]} className="w-44 h-44"
        initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.95}}
        transition={{duration:0.5}}
      />
    </AnimatePresence>
  );
}
