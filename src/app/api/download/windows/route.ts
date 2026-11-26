import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function findInstallerPath() {
  const publicDownloadPath = path.join(process.cwd(), "public", "downloads", "ShopX-Elite-Setup.exe");
  if (fs.existsSync(publicDownloadPath)) {
    return publicDownloadPath;
  }

  const distDir = path.join(process.cwd(), "dist");
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir);
    const exeFile = files.find((f) => f.endsWith(".exe") && !f.includes("blockmap"));
    if (exeFile) {
      const sourcePath = path.join(distDir, exeFile);
      const downloadsDir = path.join(process.cwd(), "public", "downloads");
      if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true });
      }
      fs.copyFileSync(sourcePath, publicDownloadPath);
      return publicDownloadPath;
    }
  }
  return null;
}

export async function HEAD() {
  const filePath = findInstallerPath();
  if (filePath) {
    const stat = fs.statSync(filePath);
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.microsoft.portable-executable",
        "Content-Length": stat.size.toString(),
      },
    });
  }
  return new NextResponse(null, { status: 404 });
}

export async function GET(req: NextRequest) {
  try {
    const filePath = findInstallerPath();
    if (filePath) {
      const stat = fs.statSync(filePath);
      const fileStream = fs.createReadStream(filePath);
      const stream = new ReadableStream({
        start(controller) {
          fileStream.on("data", (chunk) => controller.enqueue(chunk));
          fileStream.on("end", () => controller.close());
          fileStream.on("error", (err) => controller.error(err));
        },
      });

      return new NextResponse(stream, {
        headers: {
          "Content-Type": "application/vnd.microsoft.portable-executable",
          "Content-Disposition": 'attachment; filename="ShopX-Elite-Setup.exe"',
          "Content-Length": stat.size.toString(),
        },
      });
    }

    return NextResponse.json(
      {
        ready: false,
        message: "The Windows installer (.exe) has not been compiled yet. Please run 'npm run electron:build' to generate the installer.",
      },
      { status: 404 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to download Windows setup", details: error.message },
      { status: 500 }
    );
  }
}
