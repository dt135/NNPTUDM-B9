var express = require("express");
var router = express.Router();

let mongoose = require("mongoose");
let messageModel = require("../schemas/messages");
let userModel = require("../schemas/users");
let { checkLogin } = require("../utils/authHandler.js");

router.get("/:userID", checkLogin, async function (req, res, next) {
    try {
        let currentUserId = req.userId;
        let otherUserId = req.params.userID;

        if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
            return res.status(400).send({ message: "userID khong hop le" });
        }

        let otherUser = await userModel.findOne({
            _id: otherUserId,
            isDeleted: false
        });

        if (!otherUser) {
            return res.status(404).send({ message: "user khong ton tai" });
        }

        let messages = await messageModel
            .find({
                $or: [
                    { from: currentUserId, to: otherUserId },
                    { from: otherUserId, to: currentUserId }
                ]
            })
            .sort({ createdAt: 1 })
            .populate("from", "username email fullName avatarUrl")
            .populate("to", "username email fullName avatarUrl");

        res.send(messages);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

router.post("/", checkLogin, async function (req, res, next) {
    try {
        let currentUserId = req.userId;
        let { to, type, text } = req.body;

        if (!mongoose.Types.ObjectId.isValid(to)) {
            return res.status(400).send({ message: "to khong hop le" });
        }

        if (!["file", "text"].includes(type)) {
            return res.status(400).send({ message: "type phai la file hoac text" });
        }

        if (!text || typeof text !== "string" || !text.trim()) {
            return res.status(400).send({ message: "text khong duoc rong" });
        }

        if (currentUserId === to) {
            return res.status(400).send({ message: "khong the gui tin nhan cho chinh minh" });
        }

        let receiver = await userModel.findOne({
            _id: to,
            isDeleted: false
        });

        if (!receiver) {
            return res.status(404).send({ message: "nguoi nhan khong ton tai" });
        }

        let newMessage = new messageModel({
            from: currentUserId,
            to: to,
            messageContent: {
                type: type,
                text: text.trim()
            }
        });

        let result = await newMessage.save();
        result = await result.populate("from", "username email fullName avatarUrl");
        result = await result.populate("to", "username email fullName avatarUrl");

        res.send(result);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

router.get("/", checkLogin, async function (req, res, next) {
    try {
        let currentUserId = req.userId;

        let allMessages = await messageModel
            .find({
                $or: [
                    { from: currentUserId },
                    { to: currentUserId }
                ]
            })
            .sort({ createdAt: -1 })
            .populate("from", "username email fullName avatarUrl")
            .populate("to", "username email fullName avatarUrl");

        let latestMessageByUser = new Map();

        for (const message of allMessages) {
            let otherUserId =
                String(message.from._id) === String(currentUserId)
                    ? String(message.to._id)
                    : String(message.from._id);

            if (!latestMessageByUser.has(otherUserId)) {
                latestMessageByUser.set(otherUserId, message);
            }
        }

        res.send(Array.from(latestMessageByUser.values()));
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

module.exports = router;
