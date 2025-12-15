const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const cloudinaryFolder =
  process.env.CLOUDINARY_FOLDER || "docify-uploads";

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const bucketName = req.baseUrl.split("/api/")[1];
    const folder =
      bucketName == null || bucketName === ""
        ? cloudinaryFolder
        : `${cloudinaryFolder}/${bucketName}`;

    return {
      folder,
      resource_type: "auto",
      public_id: `${Date.now()}_${file.originalname}`,
    };
  },
});

const uploadImage = multer({
  storage,
  fileFilter: (req, file, callback) => {
    if (req.body.image_updated && req.body.image_updated === "false")
      return callback(null, false);
    return callback(null, true);
  },
  limits: {
    fileSize: 1024 * 1024 * 100, // 100mb file size
  },
});

const deleteImage = async (url) =>
  new Promise(async (resolve) => {
    try {
      // Extract public_id (with folder) from a Cloudinary URL
      // Example: https://res.cloudinary.com/<cloud>/image/upload/v123/folder/name.ext
      const withoutQuery = url.split("?")[0];
      const parts = withoutQuery.split("/");
      const uploadIndex = parts.findIndex((p) => p === "upload");
      if (uploadIndex === -1) {
        return resolve();
      }
      const pathParts = parts.slice(uploadIndex + 2); // skip "upload" and version segment
      const last = pathParts.pop();
      const baseName = last.split(".")[0];
      const publicId =
        pathParts.length > 0
          ? `${pathParts.join("/")}/${baseName}`
          : baseName;

      await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
      });
    } catch (e) {
      console.error(e);
    }
    resolve();
  });

module.exports = { cloudinary, uploadImage, deleteImage };
