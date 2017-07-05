const zlib = require('zlib');
const zmq = require('zeromq');
const sock = zmq.socket('sub');
const express = require('express');
const MongoClient = require('mongodb').MongoClient
const Raven = require('raven');
const moment = require('moment');
const paginate = require("paginate-array");

const app = express();
Raven.config('https://7c3174b16e384349bbf294978a65fb0c:c61b0700a2894a03a46343a02cf8b724@sentry.io/187248').install();

const url = 'mongodb://localhost:54373/eddn';
sock.connect('tcp://eddn.edcd.io:9500');
console.log('Worker connected to port 9500');

sock.subscribe('');

sock.on('message', topic => {
	zlib.inflate(topic, (err, res) => {
		if (err) {
			console.error(err);
			Raven.captureException(err);
		}
		const message = JSON.parse(res);
		if (message.message.event) {
			connectDB()
				.then(db => {
					message.message.uploader = message.header.uploaderID.toString();
					message.message.unixTimestamp = moment(message.message.timestamp).valueOf();
					message.message.software = `${message.header.softwareName}@${message.header.softwareVersion}`;
					const collection = db.collection('eddnHistory');
					collection.insertOne(message.message).then(result => {
						console.log('inserted ' + message.message.event + ' from: ' + message.message.uploader);
						db.close();
					}).catch(err => {
						console.error(err);
						Raven.captureException(err);
						db.close();
					})
				}).catch(err => {
					Raven.captureException(err);
					console.error(err);
				});
		}
	})
});

function connectDB() {
	return new Promise((resolve, reject) => {
		MongoClient.connect(url, (err, db) => {
			if (err) {
				reject(err);
			} else {
				resolve(db);
			}
		});
	});
}
app.get('/', (req, res, next) => {
	res.send('hello');
});

app.get('/cmdr/:cmdr', (req, res, next) => {
	const cmdr = req.params.cmdr;
	const page = req.query.page;
	if (!page) {
		console.log('No page query, sending first 50');
	}
	connectDB()
		.then(db => {
			const collection = db.collection('eddnHistory');
			collection.find({uploader: cmdr}).toArray((err, docs) => {
				if (err) {
					console.error(err);
					Raven.captureException(err);
				};
				const paginated = paginate(docs, page || 1, 25);
				res.json(paginated);
				db.close();
			});
		}).catch(err => {
			Raven.captureException(err);
			console.error(err);
			db.close();
		})
});

app.get('/system/:system', (req, res, next) => {
	const system = req.params.system;
	const page = req.query.page;
	if (!page) {
		console.log('No page query, sending first 50');
	}
	connectDB()
		.then(db => {
			const collection = db.collection('eddnHistory');
			collection.find({StarSystem: system}).toArray((err, docs) => {
				if (err) {
					console.error(err);
					Raven.captureException(err);
				};
				const paginated = paginate(docs, page || 1, 25);
				res.json(paginated);
				db.close();
			});
		}).catch(err => {
			Raven.captureException(err);
			console.error(err);
			db.close();
		})
});

app.get('/station/:station', (req, res, next) => {
	const station = req.params.cmdr;
	const page = req.query.page;
	if (!page) {
		console.log('No page query, sending 50');
	}
	connectDB()
		.then(db => {
			const collection = db.collection('eddnHistory');
			collection.find({StationName: station}).toArray((err, docs) => {
				if (err) {
					console.error(err);
					Raven.captureException(err);
				};
				const paginated = paginate(docs, page || 1, 25);
				res.json(paginated);
				db.close();
			});
		}).catch(err => {
			Raven.captureException(err);
			console.error(err);
			db.close();
		})
});
app.listen(5125, function () {
	console.log('Server listening on 5125')
})
