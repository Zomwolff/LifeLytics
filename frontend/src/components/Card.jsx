
export default function Card({ children, className="" }) {
  return <div className={`bg-black text-white rounded-2xl p-4 shadow ${className}`}>{children}</div>;
}
