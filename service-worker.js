console.log("service-worker.js");

async function fetchAssignments() {
  console.log("Fetching assignments...");
  const url = "https://mls-lms.vercel.app/api/trpc/assignments.listMine";

  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error(`HTTP Error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Assignments payload received:", data);
    return data;
  } catch (error) {
    console.error("Could not fetch assignments:", error);
  }
}

fetchAssignments();