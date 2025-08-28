// client/src/app/page.tsx
import CallWidget from "../components/CallWidget";

export default function HomePage() {
  return (
    <main className="p-6">
      <h1 className="text-xl font-bold mb-4">Realtime GPT Call Demo</h1>
      <CallWidget />
    </main>
  );
}
