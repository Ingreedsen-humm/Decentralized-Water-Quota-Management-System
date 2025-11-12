(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-QUOTA-NOT-FOUND u101)
(define-constant ERR-INVALID-RECIPIENT u102)
(define-constant ERR-INVALID-AMOUNT u103)
(define-constant ERR-INVALID-BASIN u104)
(define-constant ERR-INVALID-EXPIRATION u105)
(define-constant ERR-QUOTA-LOCKED u106)
(define-constant ERR-QUOTA-BURN-FAILED u107)
(define-constant ERR-QUOTA-ALREADY-MINTED u108)
(define-constant ERR-INVALID-OWNER u109)
(define-constant ERR-QUOTA-FROZEN u110)
(define-constant ERR-METADATA-NOT-SET u111)
(define-constant ERR-ORACLE-NOT-AUTHORIZED u112)
(define-constant ERR-INSUFFICIENT-QUOTA u113)
(define-constant ERR-BURN-AMOUNT-EXCEEDS u114)
(define-constant ERR-TRANSFER-LOCKED u115)
(define-constant ERR-QUOTA-EXPIRED u116)
(define-constant ERR-INVALID-NFT-ID u117)
(define-constant ERR-MAX-QUOTA-REACHED u118)
(define-constant ERR-INVALID-FRACTIONAL u119)

(define-data-var admin principal tx-sender)
(define-data-var oracle-principal (optional principal) none)
(define-data-var next-quota-id uint u1)
(define-data-var basin-max-quota uint u1000000000)
(define-data-var quota-frozen bool false)

(define-non-fungible-token water-quota uint)

(define-map quota-metadata
  uint
  {
    basin-id: (string-ascii 50),
    amount-m3: uint,
    expiration-year: uint,
    issued-at: uint,
    locked: bool,
    transferable: bool,
    burnable: bool,
    fractional-allowed: bool
  }
)

(define-map basin-quotas
  (string-ascii 50)
  uint
)

(define-map quota-usage
  uint
  {
    used-m3: uint,
    last-updated: uint
  }
)

(define-read-only (get-quota (id uint))
  (nft-get-owner? water-quota id)
)

(define-read-only (get-quota-details (id uint))
  (map-get? quota-metadata id)
)

(define-read-only (get-quota-usage (id uint))
  (map-get? quota-usage id)
)

(define-read-only (get-total-issued-in-basin (basin (string-ascii 50)))
  (default-to u0 (map-get? basin-quotas basin))
)

(define-read-only (is-admin)
  (is-eq tx-sender (var-get admin))
)

(define-read-only (is-oracle)
  (match (var-get oracle-principal)
    oracle (is-eq tx-sender oracle)
    false
  )
)

(define-private (validate-basin (basin (string-ascii 50)))
  (if (and (> (len basin) u0) (<= (len basin) u50))
    (ok true)
    (err ERR-INVALID-BASIN)
  )
)

(define-private (validate-amount (amount uint))
  (if (> amount u0)
    (ok true)
    (err ERR-INVALID-AMOUNT)
  )
)

(define-private (validate-expiration (year uint))
  (if (>= year u2025)
    (ok true)
    (err ERR-INVALID-EXPIRATION)
  )
)

(define-private (validate-recipient (recipient principal))
  (if (not (is-eq recipient tx-sender))
    (ok true)
    (err ERR-INVALID-RECIPIENT)
  )
)

(define-public (set-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set admin new-admin)
    (ok true)
  )
)

(define-public (set-oracle (new-oracle principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set oracle-principal (some new-oracle))
    (ok true)
  )
)

(define-public (freeze-all-quotas)
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set quota-frozen true)
    (ok true)
  )
)

(define-public (unfreeze-all-quotas)
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set quota-frozen false)
    (ok true)
  )
)

(define-public (mint-quota
  (recipient principal)
  (basin (string-ascii 50))
  (amount-m3 uint)
  (expiration-year uint)
  (transferable bool)
  (burnable bool)
  (fractional-allowed bool)
)
  (let (
    (quota-id (var-get next-quota-id))
    (current-basin-total (default-to u0 (map-get? basin-quotas basin)))
    (new-total (+ current-basin-total amount-m3))
  )
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (try! (validate-recipient recipient))
    (try! (validate-basin basin))
    (try! (validate-amount amount-m3))
    (try! (validate-expiration expiration-year))
    (asserts! (<= new-total (var-get basin-max-quota)) (err ERR-MAX-QUOTA-REACHED))
    (try! (nft-mint? water-quota quota-id recipient))
    (map-set quota-metadata quota-id
      {
        basin-id: basin,
        amount-m3: amount-m3,
        expiration-year: expiration-year,
        issued-at: block-height,
        locked: false,
        transferable: transferable,
        burnable: burnable,
        fractional-allowed: fractional-allowed
      }
    )
    (map-set basin-quotas basin new-total)
    (map-set quota-usage quota-id { used-m3: u0, last-updated: block-height })
    (var-set next-quota-id (+ quota-id u1))
    (print { event: "quota-minted", id: quota-id, recipient: recipient, amount: amount-m3 })
    (ok quota-id)
  )
)

(define-public (transfer-quota (id uint) (recipient principal))
  (let ((owner (unwrap! (nft-get-owner? water-quota id) (err ERR-QUOTA-NOT-FOUND)))
        (metadata (unwrap! (map-get? quota-metadata id) (err ERR-METADATA-NOT-SET)))
        (expiration (get expiration-year metadata)))
    (asserts! (not (var-get quota-frozen)) (err ERR-QUOTA-FROZEN))
    (asserts! (is-eq tx-sender owner) (err ERR-INVALID-OWNER))
    (asserts! (get transferable metadata) (err ERR-TRANSFER-LOCKED))
    (asserts! (>= expiration block-height) (err ERR-QUOTA-EXPIRED))
    (try! (nft-transfer? water-quota id tx-sender recipient))
    (print { event: "quota-transferred", id: id, from: tx-sender, to: recipient })
    (ok true)
  )
)

(define-public (burn-quota (id uint) (amount-m3 uint))
  (let ((owner (unwrap! (nft-get-owner? water-quota id) (err ERR-QUOTA-NOT-FOUND)))
        (metadata (unwrap! (map-get? quota-metadata id) (err ERR-METADATA-NOT-SET)))
        (total-amount (get amount-m3 metadata))
        (usage (unwrap! (map-get? quota-usage id) (err ERR-QUOTA-NOT-FOUND))))
    (asserts! (is-eq tx-sender owner) (err ERR-INVALID-OWNER))
    (asserts! (get burnable metadata) (err ERR-QUOTA-BURN-FAILED))
    (asserts! (<= amount-m3 (- total-amount (get used-m3 usage))) (err ERR-BURN-AMOUNT-EXCEEDS))
    (asserts! (> amount-m3 u0) (err ERR-INVALID-AMOUNT))
    (map-set quota-metadata id (merge metadata { amount-m3: (- total-amount amount-m3) }))
    (map-set quota-usage id (merge usage { used-m3: (+ (get used-m3 usage) amount-m3), last-updated: block-height }))
    (print { event: "quota-burned", id: id, amount: amount-m3 })
    (ok true)
  )
)

(define-public (report-usage (quota-id uint) (used-m3 uint))
  (let ((metadata (unwrap! (map-get? quota-metadata quota-id) (err ERR-METADATA-NOT-SET)))
        (usage (default-to { used-m3: u0, last-updated: u0 } (map-get? quota-usage quota-id)))
        (total-amount (get amount-m3 metadata)))
    (asserts! (or (is-oracle) (is-admin)) (err ERR-ORACLE-NOT-AUTHORIZED))
    (asserts! (<= (+ (get used-m3 usage) used-m3) total-amount) (err ERR-INSUFFICIENT-QUOTA))
    (map-set quota-usage quota-id { used-m3: (+ (get used-m3 usage) used-m3), last-updated: block-height })
    (print { event: "usage-reported", quota-id: quota-id, used-m3: used-m3, total-used: (+ (get used-m3 usage) used-m3) })
    (ok true)
  )
)

(define-public (lock-quota (id uint))
  (let ((metadata (unwrap! (map-get? quota-metadata id) (err ERR-METADATA-NOT-SET)))
        (owner (unwrap! (nft-get-owner? water-quota id) (err ERR-QUOTA-NOT-FOUND))))
    (asserts! (or (is-admin) (is-eq tx-sender owner)) (err ERR-NOT-AUTHORIZED))
    (map-set quota-metadata id (merge metadata { locked: true }))
    (print { event: "quota-locked", id: id })
    (ok true)
  )
)

(define-public (unlock-quota (id uint))
  (let ((metadata (unwrap! (map-get? quota-metadata id) (err ERR-METADATA-NOT-SET)))
        (owner (unwrap! (nft-get-owner? water-quota id) (err ERR-QUOTA-NOT-FOUND))))
    (asserts! (or (is-admin) (is-eq tx-sender owner)) (err ERR-NOT-AUTHORIZED))
    (map-set quota-metadata id (merge metadata { locked: false }))
    (print { event: "quota-unlocked", id: id })
    (ok true)
  )
)

(define-public (split-quota (id uint) (amount-m3 uint) (recipient principal))
  (let (
    (owner (unwrap! (nft-get-owner? water-quota id) (err ERR-QUOTA-NOT-FOUND)))
    (metadata (unwrap! (map-get? quota-metadata id) (err ERR-METADATA-NOT-SET)))
    (total-amount (get amount-m3 metadata))
    (new-id (var-get next-quota-id))
  )
    (asserts! (is-eq tx-sender owner) (err ERR-INVALID-OWNER))
    (asserts! (get fractional-allowed metadata) (err ERR-INVALID-FRACTIONAL))
    (asserts! (> amount-m3 u0) (err ERR-INVALID-AMOUNT))
    (asserts! (< amount-m3 total-amount) (err ERR-INSUFFICIENT-QUOTA))
    (map-set quota-metadata id (merge metadata { amount-m3: (- total-amount amount-m3) }))
    (try! (nft-mint? water-quota new-id recipient))
    (map-set quota-metadata new-id
      {
        basin-id: (get basin-id metadata),
        amount-m3: amount-m3,
        expiration-year: (get expiration-year metadata),
        issued-at: block-height,
        locked: false,
        transferable: (get transferable metadata),
        burnable: (get burnable metadata),
        fractional-allowed: (get fractional-allowed metadata)
      }
    )
    (map-set quota-usage new-id { used-m3: u0, last-updated: block-height })
    (var-set next-quota-id (+ new-id u1))
    (print { event: "quota-split", original-id: id, new-id: new-id, amount: amount-m3 })
    (ok new-id)
  )
)

(define-read-only (get-next-quota-id)
  (ok (var-get next-quota-id))
)

(define-read-only (is-quota-expired (id uint))
  (match (map-get? quota-metadata id)
    metadata
      (ok (< (get expiration-year metadata) block-height))
    (err ERR-QUOTA-NOT-FOUND)
  )
)