const express = require("express")
const bodyParser = require("body-parser")
const { sprom } = require("spreadprom")

const cors = require("cors")
const mongoose = require("mongoose")
require("dotenv").config()

const app = express()
app.use(cors())
app.use(express.static("public"))

let globals = {
	schemas: {},
	models: {},
}

async function defineSchemas() {
	// users
	globals.schemas["users"] = new mongoose.Schema({
		username: {
			type: String,
			required: true,
		},
	})
	globals.models["users"] = new mongoose.model("User", globals.schemas["users"])

	// exercises
	globals.schemas["exercises"] = new mongoose.Schema({
		username: {
			type: String,
			required: true,
		},
		description: {
			type: String,
			required: true,
		},
		duration: {
			type: Number,
			required: true,
		},
		date: {
			type: String,
			required: true,
		},
	})
	globals.models["exercises"] = new mongoose.model("Exercise", globals.schemas["exercises"])
}

async function init() {
	// setup mongoose
	mongoose.connect(process.env.MONGO_URI)
	let [err, result] = await sprom(defineSchemas())
	if (err) {
		throw err
	}

	// setup routes
	app.get("/", (req, res) => {
		res.sendFile(__dirname + "/views/index.html")
	})

	app.get("/api/users/:_id/logs", (req, res) => {
		// retrieve user's exercise log
		// must support queries from, to = dates (yyyy-mm-dd); limit = number
		res.sendFile(__dirname + "/views/index.html")
	})

	app.post("/api/users", bodyParser.urlencoded({ extended: false }), async (req, res) => {
		// create a new user
		if (req.body && req.body.username && typeof req.body.username == "string") {
			// username is valid
			let user = new globals.models.users({
				username: req.body.username,
			})
			user = await user.save()
			res.json({ username: req.body.username, _id: user._id })
		} else {
			res.status(400).json({ error: "Malformed request" })
		}
	})

	app.post("/api/users/:_id/exercises", bodyParser.urlencoded({ extended: false }), async (req, res) => {
		// store a new exercise log
		if (req.params && req.params._id && typeof req.params._id == "string") {
			// id is valid, locate user it belongs to
			// let [err, user] = await sprom(globals.models.exercises.find({ _id: new mongoose.Types.ObjectId(req.params._id) }))
			let [err, user] = await sprom(globals.models.users.findById(req.params._id))
			if (err) {
				res.status(500).json({ error: "Error searching for user" })
				console.error(err)
			} else {
				console.log(user.username, req.params._id)
				if (user) {
					// user found, create exercise log
					console.log(req.body)
					if (req.body && req.body.description && req.body.duration && parseInt(req.body.duration)) {
						// input is valid
						const outObj = {
							username: user.username,
							description: req.body.description,
							duration: parseInt(req.body.duration),
							date: req.body.date ? new Date(req.body.date).toDateString() : new Date().toDateString(),
						}
						let exercise = new globals.models.exercises(outObj)
						;[err, exercise] = await sprom(exercise.save())
						if (err) {
							res.status(500).json({ error: "Error saving exercise..." })
							console.error(err)
						} else {
							res.json({ _id: req.params._id, username: user.username, date: outObj.date, duration: outObj.duration, description: outObj.description })
						}
					} else {
						res.status(400).json({ error: "Malformed request" })
					}
				} else {
					// user not found
					res.status(400).json({ error: "User not found" })
				}
			}
		} else {
			res.status(400).json({ error: "Malformed request" })
		}
	})

	const listener = app.listen(process.env.PORT || 3000, () => {
		console.log("Your app is listening on port " + listener.address().port)
	})
}

// start application
try {
	init()
} catch (err) {
	console.error(err)
}
