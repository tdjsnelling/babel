import mongoose from "mongoose";

const bookmark = new mongoose.Schema(
  {
    uid: String,
    room: String,
  },
  { timestamps: true }
);

export default mongoose.model("bookmark", bookmark);
