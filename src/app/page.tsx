import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../../lib/auth"

export default async function Home() {
  let session = null
  try {
    session = await getServerSession(authOptions)
  } catch (err) {
    console.error("Home session check error:", err)
  }

  if (session) {
    redirect("/dashboard")
  } else {
    redirect("/login")
  }
}