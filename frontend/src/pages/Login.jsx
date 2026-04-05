
import InputField from "../components/InputField";

export default function Login({ onContinue, goSignup }) {
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="bg-black text-white p-6 rounded-2xl w-80">
        <h2 className="text-center mb-4 font-bold">Login</h2>
        <div className="space-y-3">
          <InputField placeholder="Email" />
          <InputField placeholder="Password" type="password" />
        </div>
        <button onClick={onContinue} className="mt-4 w-full bg-gray-200 text-black py-2 rounded-xl">
          Continue
        </button>
        <p onClick={goSignup} className="text-xs mt-3 text-center cursor-pointer">New user? Sign Up</p>
      </div>
    </div>
  );
}
