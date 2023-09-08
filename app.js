//jshint esversion:6

const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const MongoDBSession = require("connect-mongodb-session")(session);
const ejs = require("ejs");
const socket = require("socket.io");

const app = express();
const server = app.listen(process.env.PORT || 3000, (res) => {
  console.log("Server connected!");
});
const dotenv = require("dotenv");
dotenv.config();

const io = socket(server);

io.on("connection", (socket) => {
  socket.on("chat", (data) => {
    io.sockets.emit("chat", data);
  });

  socket.on("typing", (data) => {
    socket.broadcast.emit("typing", data);
  });
});

app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

const mongoURI =  process.env.MONGO_URI;

mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
  })
  .then((res) => {
    console.log("MongoDB connected!");
    console.log("Connected to DB:", res.connections[0].name);
  });

const store = new MongoDBSession({
  uri: mongoURI,
  collection: "mySessions",
});

app.use(
  session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);

const usernamesSchema = mongoose.Schema({
  username: String,
  gender: String,
  age: String,
  platform: String,
  date: Date,
  ip: String
});

const Username = mongoose.model("Username", usernamesSchema);

const isAuth = (req, res, next) => {
  if (req.session.isAuth) {
    next();
  } else {
    res.render("home");
  }
};

app.get("/", function (req, res) {
  if (req.session.isAuth) {
    res.redirect("usernames");
  } else {
    res.render("home");
  }
});

app.get("/chat", function (req, res) {
  res.render("chat");
});

app.get("/usernames", isAuth, async function (req, res) {
  const page = req.query.page ? parseInt(req.query.page) : 1;
  const perPage = 25;

  const gender = req.query.gender ? req.query.gender : "any";
  const platform = req.query.platform ? req.query.platform : "any";

  console.log(gender, platform, page);

  const startingLimit = (page - 1) * perPage;

  let count = await Username.countDocuments({});
  let pages = Math.ceil(count / perPage);

  if ((gender === "any") & (platform === "any")) {
    Username.find({}, function (err, foundUsernames) {
      if (err) throw err;
      res.render("usernames", {
        newListItems: foundUsernames,
        page,
        pages,
        gender,
        platform,
      });
    })
      .sort({
        date: -1,
      })
      .skip(startingLimit)
      .limit(perPage);
  } else if (platform === "any") {
    count = await Username.countDocuments({
      gender: gender,
    });
    pages = Math.ceil(count / perPage);
    Username.find(
      {
        gender: gender,
      },
      callback
    )
      .sort({
        date: -1,
      })
      .skip(startingLimit)
      .limit(perPage);
  } else if (gender === "any") {
    count = await Username.countDocuments({
      platform: platform,
    });
    pages = Math.ceil(count / perPage);
    Username.find(
      {
        platform: platform,
      },
      callback
    )
      .sort({
        date: -1,
      })
      .skip(startingLimit)
      .limit(perPage);
  } else {
    count = await Username.countDocuments({
      gender: gender,
      platform: platform,
    });
    pages = Math.ceil(count / perPage);
    Username.find(
      {
        gender: gender,
        platform: platform,
      },
      callback
    )
      .sort({
        date: -1,
      })
      .skip(startingLimit)
      .limit(perPage);
  }

  function callback(err, foundUsernames) {
    if (err) throw err;
    res.render("usernames", {
      newListItems: foundUsernames,
      page,
      pages,
      gender,
      platform,
    });
  }
});

app.post("/", function (req, res) {
  var currentDate = new Date();
  var clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;// Kullanıcının IP adresini al

  const userName = new Username({
    username: req.body.username,
    gender: req.body.gender,
    age: req.body.age,
    platform: req.body.platform,
    date: currentDate,
    ip: clientIp // IP adresini veritabanına kaydet
  });


  Username.deleteMany(
    {
      username: userName.username,
      platform: userName.platform,
    },
    function (err) {
      if (err) {
        console.log(err);
      }
    }
  );

  userName.save(function (err) {
    if (!err) {
      req.session.isAuth = true;
      res.redirect("usernames");
    }
  });
});

app.post("/logout", function (req, res) {
  req.session.destroy(function (err) {
    if (err) throw err;
    res.render("home");
  });
});

app.post("/usernames", function (req, res) {
  res.render("chat");
});
