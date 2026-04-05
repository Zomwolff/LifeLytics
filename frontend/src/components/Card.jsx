
export default function Card({ children, className="" }) {
  return (
    <div
      className={`rounded-[1.75rem] border border-white/10 bg-[#0b0b0d] text-white shadow-[0_18px_40px_rgba(15,23,42,0.22)] ${className}`}
    >
      {children}
    </div>
  );
}
