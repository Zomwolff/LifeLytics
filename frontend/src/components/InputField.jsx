
export default function InputField({ placeholder, type="text" }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      className="w-full px-4 py-2 rounded-xl bg-gray-200 text-sm outline-none"
    />
  );
}
