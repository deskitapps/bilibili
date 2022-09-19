import puppeteer = require('puppeteer-core');
import yargs from 'yargs';

export async function main() {
  console.log('正在打开网页');

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  });
  const page = await browser.newPage();

  const argv = yargs(process.argv).argv;
  const config = JSON.parse(argv['config']) || {};

  page.setCookie({
    name: 'SESSDATA',
    value: String(config['SESSDATA']),
    domain: '.bilibili.com',
    path: '/',
  }, {
    name: 'bili_jct',
    value: String(config['bili_jct']),
    domain: '.bilibili.com',
    path: '/',
  }, {
    name: 'DedeUserID',
    value: String(config['DedeUserID']),
    domain: '.bilibili.com',
    path: '/',
  });

  let reward: any = {};

  // 获取每日奖励情况
  page.on('response', async (response) => {
    const url = response.url();
    if (url === 'https://api.bilibili.com/x/member/web/exp/reward') {
      reward = await response.json();
    }

    return response;
  });

  // 每日登录
  await page.goto('https://account.bilibili.com/account/home', { waitUntil: 'networkidle2' });
  console.log('每日奖励情况：' + JSON.stringify(reward));
  console.log(`每日登录情况： ${reward.data.login ? 'Yes' : 'No'}  +5 经验值`);
  console.log(`每日观看视频： ${reward.data.watch ? 'Yes' : 'No'}  +5 经验值`);
  console.log(`每日投币： ${reward.data.coins}/50`);
  console.log(`每日分享视频(客户端): ${reward.data.share ? 'Yes' : 'No'}`);

  let isWatchFinished = reward.data.watch && false;
  let isCoinFinished = reward.data.coins && false;

  if (isWatchFinished && isCoinFinished) {
    console.log('所有每日奖励均已完成');
    process.exit();
  }

  if (!isWatchFinished || !isCoinFinished) {
    console.log(!isWatchFinished ? '开始执行视频观看任务' : '开始执行视频投币任务');
    await page.goto('https://www.bilibili.com/');
    await page.waitForSelector('.bili-watch-later');
    const urls = await page.evaluate(() => Array.from(document.querySelectorAll('a[data-target-url]')).map(i => i.getAttribute('data-target-url')));
    const videos = Array.from(new Set(urls.filter(url => url && url.match(/https:\/\/www.bilibili.com\/video\/\w+/))));
    for (let i = 0; i < 5; i++) {
      const seletedVideo = videos[i] as string;
      console.log(`正在观看视频 ${seletedVideo}，观看时间 10s`);
      await page.goto(seletedVideo);

      // 观看10秒
      await new Promise(resolve => setTimeout(resolve, 10000));

      if (!isWatchFinished) {
        console.log('完成每日观看视频任务！');
        isWatchFinished = true;
      }

      if (!isCoinFinished) {
        await page.waitForSelector('.coin');
        await new Promise(resolve => setTimeout(resolve, 2000));
        page.$eval('.coin', (ele: any) => ele.click());
        await page.waitForSelector('.mc-box.left-con');
        page.$eval('.mc-box.left-con', (ele: any) => ele.click());

        const text = await page.evaluate(() => (document.querySelector('.coin-bottom .tips') as any).innerText);
        if (text.trim() === '今日投币+50经验成就 get ✓ 赞！') {
          break;
        }

        console.log('开始对视频进行投币操作');
        await page.waitForSelector('.like-checkbox input');
        page.$eval('.like-checkbox input', (ele: any) => ele.click());
        await page.waitForSelector('.coin-bottom .bi-btn');
        page.$eval('.coin-bottom .bi-btn', (ele: any) => ele.click());
        console.log('投币成功');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    isCoinFinished = true;
  }
}

main();
