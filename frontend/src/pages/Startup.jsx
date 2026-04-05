
import AvatarRotator from "../components/AvatarRotator";

export default function Startup({ goLogin, goSignup }) {
  return (
    <div className="h-screen flex flex-col items-center justify-center">
      <AvatarRotator />
      <div className="mt-4 px-4 py-2 border-2 border-blue-400 rounded-xl font-bold text-center">
        WELCOME ✨ to the TEAM
      </div>
      <div className="mt-6 flex gap-4">
        <button onClick={goLogin} className="px-5 py-2 bg-black text-white rounded-full">Login</button>
        <button onClick={goSignup} className="px-5 py-2 bg-black text-white rounded-full">Sign Up</button>
      </div>
    </div>
  );
}
