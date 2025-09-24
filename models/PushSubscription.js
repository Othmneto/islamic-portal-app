"use strict";

const mongoose = require("mongoose");

const KeysSchema = new mongoose.Schema(
  { p256dh: { type: String, required: true }, auth: { type: String, required: true } },
  { _id: false }
);

const PushSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    subscription: {
      endpoint: { type: String, required: true, trim: true, unique: true, sparse: true },
      expirationTime: { type: Number, default: null },
      keys: { type: KeysSchema, required: true }
    },
    tz: { type: String, default: "UTC", trim: true },
    preferences: { type: mongoose.Schema.Types.Mixed, default: undefined },
    location: { lat: { type: Number }, lon: { type: Number }, city: { type: String } },
    ua: { type: String },
  },
  { timestamps: true, collection: "push_subscriptions" }
);

PushSubscriptionSchema.statics.upsertFromClient = async function ({
  subscription, tz, preferences, location, userId, ua,
}) {
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    const err = new Error("Invalid subscription payload");
    err.status = 400;
    throw err;
  }
  const doc = await this.findOneAndUpdate(
    { "subscription.endpoint": subscription.endpoint },
    {
      $set: {
        userId: userId || null,
        subscription: {
          endpoint: subscription.endpoint,
          expirationTime: typeof subscription.expirationTime === "number" ? subscription.expirationTime : null,
          keys: { p256dh: String(subscription.keys.p256dh || ""), auth: String(subscription.keys.auth || "") }
        },
        tz: tz || "UTC",
        preferences: preferences || undefined,
        location: location || undefined,
        ua: ua || undefined,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true, new: true }
  );
  return doc;
};

module.exports = mongoose.model("PushSubscription", PushSubscriptionSchema);