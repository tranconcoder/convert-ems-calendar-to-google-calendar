import path from "path";

export class GoogleCalendar {
    public readonly SCOPES = ["https://www.googleapis.com/auth/calendar"];
    public readonly TOKEN_PATH = path.join(
        process.cwd(),
        "src/assets/json/token.json"
    );
}
