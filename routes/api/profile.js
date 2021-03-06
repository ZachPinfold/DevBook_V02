const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const { check, validationResult } = require("express-validator");
const request = require("request");
const config = require("config");
const normalize = require("normalize-url");
const { v4: uuidv4 } = require("uuid");
const AWS = require("aws-sdk");
const multer = require("multer");
const awsConfig = require("../../config/AWS");
const ObjectID = require("mongodb").ObjectID;

const Profile = require("../../models/Profile");
const User = require("../../models/User");
const Post = require("../../models/Post");

// @route   GET api/profile/me
// @desc    Get current user's profile
// @access  Private
router.get("/me", auth, async (req, res) => {
  try {
    const profile = await Profile.findOne({
      user: req.user.id
    }).populate("user", ["name", "avatar"]);

    if (!profile) {
      return res.status(400).json({ msg: "There is no profile for this user" });
    }
    res.json(profile);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   GET SORTED api/profile/me/experiences
// @desc    Get current user's profile
// @access  Private
router.get("/me/experiences", auth, async (req, res) => {
  try {
    var userid = await new ObjectID("5f2011a8e12242d4ffce901d");

    console.log(userid);

    const profile = await Profile.aggregate([
      // Initial document match (uses index, if a suitable one is available)
      {
        $match: {
          _id: userid
        }
      },
      { $unwind: "$experiences" },
      {
        $sort: {
          "experiences.to": -1
        }
      }
    ]);

    const currentExp = [];

    const sortedArray = await profile.map(exp => {
      if (exp.experiences.current === true) currentExp.push(exp.experiences);
      return exp.experiences;
    });

    // console.log(sortedArray);

    if (!profile) {
      return res.status(400).json({ msg: "There is no profile for this user" });
    }
    if (currentExp.length === 0) {
      res.json(sortedArray);
    }
    if (currentExp.length > 0) {
      sortedArray.pop();
      sortedArray.unshift(currentExp[0]);
      res.json(sortedArray);
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route    POST api/profile
// @desc     Create or update user profile
// @access   Private
router.post(
  "/",
  [
    auth,
    [
      check("status", "Status is required").not().isEmpty(),
      check("skills", "Skills is required").not().isEmpty()
    ]
  ],
  async (req, res) => {
    console.log(req.user);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const {
      company,
      location,
      website,
      bio,
      skills,
      status,
      githubusername,
      youtube,
      twitter,
      instagram,
      linkedin,
      facebook
    } = req.body;

    const profileFields = {
      user: req.user.id,
      company,
      location,
      website:
        website && website !== ""
          ? normalize(website, { forceHttps: true })
          : "",
      bio,
      skills: Array.isArray(skills)
        ? skills
        : skills.split(",").map(skill => " " + skill.trim()),
      status,
      githubusername
    };

    // Build social object and add to profileFields
    const socialfields = { youtube, twitter, instagram, linkedin, facebook };

    for (const [key, value] of Object.entries(socialfields)) {
      if (value && value.length > 0)
        socialfields[key] = normalize(value, { forceHttps: true });
    }
    profileFields.social = socialfields;

    try {
      // Using upsert option (creates new doc if no match is found):
      let profile = await Profile.findOneAndUpdate(
        { user: req.user.id },
        { $set: profileFields },
        { new: true, upsert: true }
      );
      res.json(profile);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  }
);

// @route   GET api/profile
// @desc    get all profiles
// @access  Public

router.get("/", async (req, res) => {
  try {
    // .populate adds the extra info from the user schema
    const profiles = await Profile.find().populate("user", ["name", "avatar"]);
    res.json(profiles);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   GET api/profile/user/:user_id
// @desc    get profile by user ID
// @access  Public

router.get("/user/:user_id", async (req, res) => {
  try {
    // .populate adds the extra info from the user schema
    const profile = await Profile.findOne({
      user: req.params.user_id
    }).populate("user", ["name", "avatar"]);

    if (!profile) return res.status(400).json({ msg: "Profile not found" });

    res.json(profile);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(400).json({ msg: "Profile not found" });
    }
    res.status(500).send("Server Error");
  }
});

// @route   DELETE api/profile
// @desc    Delete profile, user, and post
// @access  Private

router.delete("/", auth, async (req, res) => {
  try {
    // Remove user posts
    await Post.deleteMany({ user: req.user.id });
    // Remove profile
    await Profile.findOneAndRemove({ user: req.user.id });
    // Remove user
    await User.findOneAndRemove({ _id: req.user.id });

    res.json({ msg: "User removed" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   PUT api/profile/experience
// @desc    Add profile experience
// @access  Private
router.put(
  "/experience",
  [
    auth,
    [
      check("title", "Title is required").not().isEmpty(),
      check("company", "Company is required").not().isEmpty(),
      check("from", "From date is required").not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array });
    }

    const {
      title,
      company,
      location,
      from,
      to,
      current,
      description
    } = req.body;

    const newExp = {
      title,
      company,
      location,
      from,
      to,
      current,
      description
    };

    try {
      const profile = await Profile.findOne({
        user: req.user.id
      }).populate("user", ["name", "avatar"]);
      profile.experiences.unshift(newExp);
      await profile.save();
      res.json(profile);
    } catch (err) {
      console.error(err);
      res.status(500).send("Server Error");
    }
  }
);

// @route   DELETE api/profile/experience/:exp_id
// @desc    Removes experience from profile
// @access  Private

router.delete("/experience/:exp_id", auth, async (req, res) => {
  try {
    const profile = await Profile.findOne({
      user: req.user.id
    }).populate("user", ["name", "avatar"]);

    // GET remove index
    const removeIndex = profile.experiences
      .map(item => item.id)
      .indexOf(req.params.exp_id);
    profile.experiences.splice(removeIndex, 1);
    await profile.save();
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// @route   PUT api/profile/education
// @desc    Add profile education
// @access  Private
router.put(
  "/education",
  [
    auth,
    [
      check("school", "School is required").not().isEmpty(),
      check("degree", "Degree is required").not().isEmpty(),
      check("from", "From date is required").not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    console.log(res);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array });
    }

    const {
      school,
      degree,
      fieldofstudy,
      from,
      to,
      current,
      description
    } = req.body;

    const newEdu = {
      school,
      degree,
      fieldofstudy,
      from,
      to,
      current,
      description
    };

    try {
      const profile = await Profile.findOne({
        user: req.user.id
      }).populate("user", ["name", "avatar"]);
      console.log(profile);
      profile.education.unshift(newEdu);
      await profile.save();
      res.json(profile);
    } catch (err) {
      // console.error(err);
      res.status(500).send("Server Error");
    }
  }
);

// @route   DELETE api/profile/education/:exp_id
// @desc    Removes education from profile
// @access  Private

router.delete("/education/:edu_id", auth, async (req, res) => {
  try {
    const profile = await Profile.findOne({
      user: req.user.id
    }).populate("user", ["name", "avatar"]);

    // GET remove index
    const removeIndex = profile.education
      .map(item => item.id)
      .indexOf(req.params.edu_id);
    profile.education.splice(removeIndex, 1);
    await profile.save();
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// @route   GET api/profile/github/:username
// @desc    Get user repos from GitHub
// @access  Public

router.get("/github/:username", (req, res) => {
  try {
    const options = {
      uri: `https://api.github.com/users/${
        req.params.username
      }/repos?per_page=5&sort=created:asc&client_id=${config.get(
        "githubClientId"
      )}&client_secret=${config.get("githubSecret")}`,
      method: "GET",
      headers: { "user-agent": "node.js" }
    };

    request(options, (error, response, body) => {
      if (error) console.error(error);
      if (response.statusCode !== 200) {
        return res.status(404).json({ msg: "No Github profile found" });
      }
      res.json(JSON.parse(body));
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route    POST api/profile/profile_image
// @desc     Create or update user profile
// @access   Private
// router.post("/profile_image", async (req, res) => {
//   aws.config.update(awsConfig);

const storage = multer.memoryStorage({
  destination: function (req, file, callback) {
    callback(null, "");
  }
});

const upload = multer({ storage }).single("image");

const s3 = new AWS.S3({
  accessKeyId: awsConfig.awsConfig.accessKeyId,
  secretAccessKey: awsConfig.awsConfig.secretAcessKey
});

router.post("/profile_image", auth, upload, (req, res) => {
  console.log("ID====" + req.user);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let myFile = req.file.originalname.split(".");
  const fileType = myFile[myFile.length - 1];

  const params = {
    Bucket: "devbookimages",
    Key: `${uuidv4()}.${fileType}`,
    Body: req.file.buffer
  };

  s3.upload(params, async (error, data) => {
    const { key } = data;
    const fullKeyUrl = `https://devbookimages.s3.eu-west-2.amazonaws.com/${key}`;
    console.log(key);
    const profileFields = {
      user: req.user.id,
      profilePic: fullKeyUrl
    };
    // console.log(params);

    try {
      let profile = await Profile.findOneAndUpdate(
        { user: req.user.id },
        { $set: profileFields },
        { new: true, upsert: true }
      );
      res.status(200).send(profile);
    } catch (error) {
      console.error(error.message);
      res.status(500).send("Server Error");
    }
  });
});

module.exports = router;
