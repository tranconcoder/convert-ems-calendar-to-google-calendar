const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");
const { convert } = require("html-to-text");

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/calendar"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

const STUDENT_ID = 22004015;
const SEMESTER_ID = 35;
const CALENDAR_ID =
	"772c9d334b8b255d1d09c72f8b421e88eba516ed655d530da6d0f4a311532cb9@group.calendar.google.com";

async function loadSavedCredentialsIfExist() {
	try {
		const content = await fs.readFile(TOKEN_PATH);
		const credentials = JSON.parse(content);
		return google.auth.fromJSON(credentials);
	} catch (err) {
		return null;
	}
}

/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
	const content = await fs.readFile(CREDENTIALS_PATH);
	const keys = JSON.parse(content);
	const key = keys.installed || keys.web;
	const payload = JSON.stringify({
		type: "authorized_user",
		client_id: key.client_id,
		client_secret: key.client_secret,
		refresh_token: client.credentials.refresh_token,
	});
	await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
	let client = await loadSavedCredentialsIfExist();
	if (client) {
		return client;
	}
	client = await authenticate({
		scopes: SCOPES,
		keyfilePath: CREDENTIALS_PATH,
	});

	if (client.credentials) {
		await saveCredentials(client);
	}

	return client;
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listEvents(auth) {
	const calendar = google.calendar({ version: "v3", auth });
	const res = await calendar.events.list({
		calendarId: "primary",
		timeMin: new Date().toISOString(),
		maxResults: 10,
		singleEvents: true,
		orderBy: "startTime",
	});
	const events = res.data.items;
	if (!events || events.length === 0) {
		console.log("No upcoming events found.");
		return auth;
	}
	console.log("Upcoming 10 events:");
	events.map((event, i) => {
		const start = event.start.dateTime || event.start.date;
		console.log(`${start} - ${event.summary}`);
	});

	return auth;
}

async function emsCalendarToGoogleCalendar(auth) {
	const calendar = google.calendar({ version: "v3", auth });
	// Get calendar on emsVlute
	const params = new URLSearchParams();
	params.append("hocky", SEMESTER_ID);
	params.append("masv", STUDENT_ID);

	let htmlText = await fetch(
		"https://ems.vlute.edu.vn/vTKBSinhVien/ViewTKBSV",
		{
			method: "post",
			"Content-Type": "application/x-www-form-urlencoded",
			body: params,
		}
	)
		.then((res) => res.text())
		.catch(() => null);

	htmlText = htmlText
		.split("<!-- /.tab-pane - list -->")
		.at(1)
		.split("<!-- /.tab-pane - calendar -->")
		.at(0)
		.split("<tbody>")
		.at(1)
		.split("</tbody>")
		.at(0);

	const courseList = htmlText
		.split("<tr>")
		.map((v) => v.split("</tr>").at(0))
		.filter((v) => !!v)
		.map((str) => {
			const text = convert(str, {});
			const courseTextList = text.split("\n");

			return {
				courseName: courseTextList[1].split("- ")[1].split(" (")[0],
				teacher: courseTextList[2].split("GV: ")[1],
				room: courseTextList[3].split("Phòng: ")[1].split(" (")[0],
				time: courseTextList[3]
					.split("(")[1]
					.split(")")[0]
					.split(", ")[1],
				dateList: (courseTextList[5] + (courseTextList[6] || ""))
					.split("Ngày học: ")[1]
					.split(",")
					.map((v) => v.trim()),
			};
		});

	// Handle create event from data formatted
	for (let i = 0; i < courseList.length; i++) {
		const course = courseList[i];

		for (let j = 0; j < course.dateList.length; j++) {
			const date = course.dateList[j];
			const event = {
				summary: `[${course.room.split("-")[0].trim()}] ${
					course.courseName
				}`,
				description: `Giáo viên: ${course.teacher}`,
				location: `Phòng ${course.room}`,
				start: {
					dateTime: new Date(
						new Date().getFullYear(),
						Number(date.split("/")[1]) - 1,
						Number(date.split("/")[0]),
						Number(course.time.split(" - ")[0].split("g")[0]),
						Number(course.time.split(" - ")[0].split("g")[1])
					).toISOString(),
					timeZone: "Asia/Ho_Chi_Minh",
				},
				end: {
					dateTime: new Date(
						new Date().getFullYear(),
						Number(date.split("/")[1]) - 1,
						Number(date.split("/")[0]),
						Number(course.time.split(" - ")[1].split("g")[0]),
						Number(course.time.split(" - ")[1].split("g")[1])
					).toISOString(),
					timeZone: "Asia/Ho_Chi_Minh",
				},
				reminders: {
					useDefault: false,
					overrides: [
						// { method: "popup", minutes: 24 * 60 },
						{ method: "popup", minutes: 60 },
						// { method: "popup", minutes: 30 },
					],
				},
			};

			calendar.events.insert(
				{
					auth: auth,
					calendarId: CALENDAR_ID,
					resource: event,
				},
				function (err, event) {
					if (err) {
						console.log(
							"There was an error contacting the Calendar service: " +
								err
						);
					} else
						console.log(
							"Event created: " + event.config.data.summary
						);
				}
			);

			await new Promise((resolve) => setTimeout(resolve, 700));
		}
	}
}

authorize()
	.then(listEvents)
	.then(emsCalendarToGoogleCalendar)
	.catch(console.error);
