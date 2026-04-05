
import Card from "../components/Card";

export default function Home() {
  return (
    <div className="p-4 min-h-screen">
      <div className="grid grid-cols-2 gap-4">
        <Card className="col-span-1 h-40">
          <p className="text-xl font-bold">36%</p>
          <p className="text-sm mt-2">Height :</p>
          <p className="text-sm">Weight :</p>
          <p className="text-sm">BF% :</p>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>AI Insights</Card>
          <Card>Trends</Card>
        </div>

        <Card className="col-span-2">Prescription Insights</Card>
      </div>

      <div className="fixed bottom-4 left-4 right-4 bg-black text-white p-3 rounded-xl flex justify-between">
        <span>＋</span>
        <span>🔍</span>
      </div>
    </div>
  );
}
