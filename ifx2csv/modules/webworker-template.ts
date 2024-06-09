import { HEADERS, transform } from "{USERMODULE}";

self.onmessage = (e) => {
  const { t, data, seq } = e.data;
  switch (t) {
    case "headers":
      self.postMessage({ t: "headers.resp", data: { headers: HEADERS }, seq });
      break;
    case "transform": {
      const columns = transform(data.posting);
      self.postMessage({ t: "transform.resp", data: { columns }, seq });
      break;
    }
    default:
      throw new Error("unknown message type: '" + t + "'");
  }
};
