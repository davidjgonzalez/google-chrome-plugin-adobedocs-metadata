export async function genAi(systemPrompt, userPrompt, contentApiKey) {
  const response = await fetch(
    "https://81368-dxpefirefallproxy.adobeio-static.net/api/v1/web/dx-excshell-1/generic",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": `${contentApiKey}`,
      },
      body: JSON.stringify({
        systemPrompt: systemPrompt.message?.trim(),
        userPrompt: userPrompt.message?.trim(),
      }),
    }
  );

  if (!response.ok) {
    const json = await response.json();
    if (response.status === 401) {
      return `ERROR: Invalid Content API key`;
    } else {
      return `ERROR: ${response.status} -- ${json.error}`;
    }
  }

  const json = await response.json();
  console.log(json);
  return json;
}
