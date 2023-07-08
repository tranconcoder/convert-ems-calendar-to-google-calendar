import fs from "fs/promises";
import path from "path";
import process from "process";
import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";

const { STUDENT_ID, SEMESTER_ID, CALENDAR_ID } = require("./config");
const { getCourseList } = require("./utils/methods");

const CREDENTIALS_PATH = path.join(
	process.cwd(),
	"./assets/json/credentials.json"
);

async function loadSavedCredentialsIfExist() {
	try {
		const content = await fs.readFile(TOKEN_PATH);
		const credentials = JSON.parse(content);
		return google.auth.fromJSON(credentials);
	} catch (err) {
		return null;
	}
}

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

async function authorize() {
	let client = await loadSavedCredentialsIfExist();

	if (client) return client;

	client = await authenticate({
		scopes: SCOPES,
		keyfilePath: CREDENTIALS_PATH,
	});

	if (client.credentials) {
		await saveCredentials(client);
	}

	return client;
}

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

	const courseList = await getCourseList(params);

	// Handle create event from data formatted
	for (let i = 0; i < courseList.length; i++) {
		const course = courseList[i];

		for (let j = 0; j < course.dateList.length; j++) {
			const date = course.dateList[j];
			const event = {
				summary: `[${course.room.split("-")[0].trim()}] ${
					course.courseName
				}`,
				description: `Giáo viên: ${course.teacher};\nPhòng: ${course.room};`,
				location: `Phòng: ${course.room}`,
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
						{ method: "popup", minutes: 12 * 60 },
						{ method: "popup", minutes: 60 },
						{ method: "popup", minutes: 30 },
						{ method: "popup", minutes: 15 },
						{ method: "popup", minutes: 5 },
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
