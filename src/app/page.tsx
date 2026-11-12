import { redirect } from "next/navigation";

// Las únicas pantallas son /master y /display.
export default function Home() {
  redirect("/master");
}
