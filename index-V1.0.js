async function fetchHtml(url) {
	var res = await fetch(url)
	var htmlText = await res.text()
	return htmlText
}


function parseTimeStr(str) {
	return new Date(str.replace(/年|月/ig, '-').replace(/日|分/ig, '').replace('时', ':')).getTime()
}
function parseTime(html) {
	try {
		var startTimeText = html.match(/(?<=报名时间从：).*?(?= 开始)/)[0]
		return {
			startTime: parseTimeStr(startTimeText),
		}

	} catch {
		// 课程已开始
		if (parseClassInfo(html)) {
			return {startTime: 0}
		}
		throw Error()
	}
}

function parseClassInfo(html) {
	var id = html.match(/(?<=class_id" value=").*?(?=">)/)[0]
	var score = html.match(/(?<=name="scores" type="hidden"  value=").*?(?=">)/)[0]

	return { id, score }
}

function checkCanSignUp(html) {
	return !!html.includes('/statics/frontpages/user/images/monitor_ok.png')
}

function print(...args) {
	console.log('%c' + args.join(' '), 'color: rgb(47, 109, 232);font-size: 24px;')
}


function repeat(func, num) {
	return Array.from({ length: num }).map(() => func())
}

function signUp(url, startTime) {

	var classInfo
	var getClassId = async () => {
		if (classInfo) return

		var html = await fetchHtml(url)
		var res = parseClassInfo(html)
		classInfo = res
	}

	print('开始报名')

	return new Promise((resolve) => {
		var jobs = []

		var successed = false
		var success = () => {
			resolve()
			successed = true
		}
		
		var fail = async () => {
			if (successed) {
				return
			}

			if (startTime > Date.now()) {
				// 抢课还未开始，限制频率
				await new Promise((resolve) => setTimeout(resolve, 500))
			}
			debugger

			jobs.push(genJob())
			print(`报名失败，${jobs.length}次重试中...`)
		}

		var genJob = async () => {
			try {
				await getClassId()
				var formData = new FormData();
				formData.append('class_id', classInfo.id)
				formData.append('scores', classInfo.score)
				formData.append('dopost', 'classbook')

	
				var res = await fetch('http://ea.uibe.edu.cn/user/do', {
					method: 'POST',
					body: formData,
				})
				var text = await res.text()
				if (text.includes('报名成功，转入我的课程！')) {
					print('报名成功，请验证')
					success()
				} else {
					fail()
				}
			} catch (error) {
				fail()
			}
		}

		// 同时维持5个请求
		jobs = repeat(genJob, 5)
	})
}


(async () => {
	var eleList = window.document.querySelector("#main").contentDocument.querySelectorAll("body > div.container-fluid > table > tbody > tr > td.text-left > a")
	var classList = Array.from(eleList).map(ele => {
		return {
			title: ele.innerText,
			id: ele.href.split('=')[1]
		}
	})

	var input = prompt('请输入课程名称')

	while (!classList.find(item => item.title.includes(input))) {
		input = prompt('当前页面找不到该课程，请重新输入')
		if (!input) {
			return
		}
	}

	var calssItem = classList.find(item => item.title.includes(input))

	var tryUrl = `http://ea.uibe.edu.cn/user/class_book?id=${calssItem.id}&uact=confirm`

	var htmlText = await fetchHtml(tryUrl)

	var { startTime, endTime } = parseTime(htmlText)

	var currentTime = Date.now()

	var printWaitLog = () => {
		print(`距课程[${calssItem.title}]报名开始还有`, parseInt(startTime - Date.now() / 1000), '秒, 等待中...')
	}
	printWaitLog()
	var timer = setInterval(() => {
		printWaitLog()
	}, 5000);

	// 提前5秒开始
	var waitTime = startTime - currentTime - 5000
	// 若已经开始，直接报名
	waitTime = waitTime < 0 ? 0 :waitTime;

	setTimeout(async () => {
		clearInterval(timer)
		await signUp(tryUrl, startTime)
		print('报名成功，请验证')
	}, waitTime)
})()