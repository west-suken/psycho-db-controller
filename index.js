const flatten = require('array-flatten')
const firebase = require('firebase')
let app, db, auth

let reservingSeats = {}

let collectionName = 'psychopath'

const dbClient = {
  async initializeApp(signIn, config) {
    app = firebase.initializeApp(config.firebase)
    db = app.firestore()
    auth = app.auth()
    if (firebase.analytics) {
      firebase.analytics()
    }
    if (config.collectionName) {
      collectionName = config.collectionName
    }

    await signIn(auth)
  },
  getPerformanceList() {
    return new Promise((resolve, reject) => {
      db.collection(collectionName).get().then(querySnapshot => {
        const result = {}
        for (let queryDocSnapshot of querySnapshot.docs) {
          result[queryDocSnapshot.id] = fixSeatsFormat(queryDocSnapshot.data())
        }
        resolve(result)
      }).catch(err => {
        reject(err)
      })
    })
  },
  getPerformance(performanceName) {
    return new Promise((resolve, reject) => {
      let docRef = db.collection(collectionName).doc(performanceName)
      docRef.get().then(doc => {
        if(!doc.exists) {
          resolve('document is not found')
          return
        }
        resolve(fixSeatsFormat(doc.data()))
      }).catch(err => {
        reject(err)
      })
    })
  },
  // from: setReservationBeta
  setReservation(performanceName, seatIndex, seat) {
    return new Promise((resolve, reject) => {
      let docRef = db.collection(collectionName).doc(performanceName)
      docRef.get().then(doc => {
        if(!doc.exists) {
          resolve('document is not found')
          return
        }
        const performance = doc.data()
        if (typeof performance !== 'object') {
          resolve(performance)
          return
        }
        if (performance.seats && !isSeatVacant(performance.seats, seatIndex)) {
          resolve('The seat is already reserved!')
          return
        }
        const flattenFormation = flatten(JSON.parse(performance.formation))
        if (flattenFormation[seatIndex] === 0) {
          resolve('The seat is not available!')
          return
        }
        if (performance.status === 'pre-open' && flattenFormation[seatIndex] === 1) {
          resolve('The seat is not available in pre-open!')
          return
        }
        let reservationCount = 0
        for (let seatIndex in performance.seats) {
          if (performance.seats[seatIndex].id === seat.id) {
            reservationCount++
          }
        }
        if (reservationCount >= 2) {
          resolve('Max reservation count exceeded.')
          return
        }
        // let seats = {}
        // seats[seatIndex] = seat
        // const newSeats = performance.seats.slice(0)
        seat.seatIndex = seatIndex
        // newSeats.push(seat)
        const _docRef = db.collection(collectionName).doc(performanceName)

        const seatPos = `${collectionName}.${performanceName}.${seatIndex}`
        if (typeof reservingSeats[seatPos] !== 'undefined') {
          resolve('Someone is making reservation just now')
          return
        }
        _docRef.update({
          seats: firebase.firestore.FieldValue.arrayUnion(seat)
        }).then(() => {
          delete reservingSeats[seatPos]
          resolve('success')
        }).catch(error => {
          reject(error)
        })
      }).catch(error => void reject(error))
    })
  },
  getReservationList(userId) {
    return new Promise((resolve, reject) => {
      dbClient.getPerformanceList(collectionName).then(performances => {
        const result = []
        for (let title in performances) {
          for (let seatIndex in performances[title].seats) {
            if (performances[title].seats[seatIndex].id === userId) {
              result.push({
                title,
                seatIndex: parseInt(seatIndex)
              })
            }
          }
        }
        resolve(result)
      }).catch(err => void reject(err))
    })
  },
  // from beta
  cancelReservation(performanceName, seatIndex, userId) {
    return new Promise((resolve, reject) => {
      let docRef = db.collection(collectionName).doc(performanceName)
      docRef.get().then(doc => {
        if(!doc.exists) {
          resolve('document is not found')
          return
        }
        const performance = doc.data()
        const accurateSeats = performance.seats.filter(_seat => _seat.id === userId && _seat.seatIndex === seatIndex)
        if (isSeatVacant(performance.seats, seatIndex)) {
          resolve('no valid seat')
          return
        }
        const theSeat = Object.assign({}, accurateSeats[0])
        // console.log(theSeat)
        // const newSeats = performance.seats.filter(_seat => !(_seat.id === userId && _seat.seatIndex === seatIndex))
        const _docRef = db.collection(collectionName).doc(performanceName)
        _docRef.update({
          seats: firebase.firestore.FieldValue.arrayRemove(theSeat)
        }).then(() => {
          resolve('success')
        }).catch(err => void reject(err))
      }).catch(err => {
        reject(err)
      })
    })
  },
  changeStatus(performanceName, status) {
    return new Promise((resolve, reject) => {
      const availableStatuses = [
        'closed',
        'open',
        'pre-open',
        'outdated',
        'sent-notification'
      ]
      if (availableStatuses.indexOf(newStatus) === -1) {
        resolve('the status is invalid')
        return
      }
      const docRef = db.collection(collectionName).doc(performanceName)
      docRef.get().then(doc => {
        if (!doc.exists) {
          resolve('document is not found')
          return
        }
        docRef.set({
          status: newStatus
        }, { merge: true }).then(() => {
          resolve('success')
        }).catch(error => void reject(error))
      }).catch(error => void reject(error))
    })
  }
}

function fixSeatsFormat(performance) {
  const newSeats = {}
  for (let seat of performance.seats) {
    if (seat.type === 'removed') {
      if (newSeats[seat.seatIndex.toString()]) {
        delete newSeats[seat.seatIndex.toString()]
      } else {
        console.warn('overlapped reservation-removing detected!')
      }
    } else {
      if (typeof newSeats[seat.seatIndex.toString()] !== 'undefined') {
        console.warn('overlapped reservation detected!')
      }
      newSeats[seat.seatIndex.toString()] = seat
    }
  }
  const newPerformance = Object.assign({}, performance)
  newPerformance.seats = newSeats
  return newPerformance
}

function isSeatVacant(seats, seatIndex) {
  let result = true
  for (let seat of seats) {
    if (seat.seatIndex === seatIndex) {
      if (seat.type === 'removed') {
        result = true
      } else {
        result = false
      }
    }
  }
  return result
}

module.exports = dbClient
