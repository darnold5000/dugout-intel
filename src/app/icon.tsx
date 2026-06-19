import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Lucide Target-style icon in Dugout Intel primary blue */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "white",
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            border: "2px solid #3b82f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: "2px solid #3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#3b82f6",
              }}
            />
          </div>
        </div>
      </div>
    ),
    { width: 32, height: 32 }
  );
}
