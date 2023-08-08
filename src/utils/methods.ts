import { convert } from "html-to-text";

interface CalendarEvent {
    courseName: string;
    teacher: string;
    room: string;
    time: string;
    dateList: string[];
}

export async function getCourseList(params: URLSearchParams) {
    let htmlText = await fetch(
        "https://ems.vlute.edu.vn/vTKBSinhVien/ViewTKBSV",
        {
            method: "post",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params,
        }
    )
        .then((res) => res.text())
        .catch(() => undefined);

    if (!htmlText) return null;

    htmlText = (htmlText as string)
        .split("<!-- /.tab-pane - list -->")
        .at(1)
        ?.split("<!-- /.tab-pane - calendar -->")
        ?.at(0)
        ?.split("<tbody>")
        ?.at(1)
        ?.split("</tbody>")
        ?.at(0);

    const courseList = (htmlText as string)
        .split("<tr>")
        .map((v) => v.split("</tr>").at(0))
        .filter((v) => !!v)
        .map((str) => {
            const text = convert(str as string, {});
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
                    .map((v: any) => v.trim()),
            } as CalendarEvent;
        });

    return courseList;
}
