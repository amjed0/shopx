import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import dbConnect from "../../../../../lib/mongodb";
import Shop from "../../../../../models/Shop";

const DEFAULT_WINDOWS_URL =
  process.env.NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL ||
  "https://github.com/amjed0/shopx/releases/latest/download/ShopX-Elite-Setup.exe";

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

async function getRemoteDownloadUrl() {
  try {
    await dbConnect();
    const shop = await Shop.findOne().sort({ createdAt: -1 });
    if (shop?.windowsAppUrl && shop.windowsAppUrl.trim().length > 0) {
      return shop.windowsAppUrl.trim();
    }
  } catch {
    // ignore DB errors on cold start
  }
  return DEFAULT_WINDOWS_URL;
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
  const remoteUrl = await getRemoteDownloadUrl();
  return NextResponse.redirect(remoteUrl, 302);
}

export async function GET(req: NextRequest) {
  try {
    // 1. If running locally with file on disk, stream directly
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

    // 2. On Vercel / Cloud: Redirect to hosted storage or GitHub Release asset
    const remoteUrl = await getRemoteDownloadUrl();
    return NextResponse.redirect(remoteUrl, 302);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to process download request", details: error.message },
      { status: 500 }
    );
  }
}
