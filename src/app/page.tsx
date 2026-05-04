import EventList from "@/components/EventList";

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px" }}>
      <EventList />
    </main>
  );
}
