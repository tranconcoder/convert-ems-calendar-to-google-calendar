const { convert } = require("html-to-text");

async function getCourseList(params) {
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

	return courseList;
}

module.exports = {
	getCourseList,
};
