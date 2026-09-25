require("dotenv").config();

async function checkAccount() {
  const apiKey = process.env.ELASTIC_EMAIL_API_KEY;
  console.log("Checking Elastic Email API key with prefix:", apiKey?.slice(0, 10));

  try {
    const res = await fetch("https://api.elasticemail.com/v4/account", {
      headers: {
        "X-ElasticEmail-ApiKey": apiKey,
      },
    });
    console.log("Status:", res.status);
    const body = await res.text();
    console.log("Response body:", body);
  } catch (err) {
    console.error("Fetch error:", err.message);
  }
}

checkAccount();
