---
title: "Trusting the Face on a Live Video Call"
subtitle: "Literature review and gap analysis: content authenticity, tamper-evidence and provenance for live, interactive, relay-mediated video calls"
date: "15 November 2026"
---

# Executive summary

**Bottom line (details and evidence below):**

1. **Direction A (authenticity through a relay that *re-encodes*) is mostly either already solved or not relevant to modern calls.** End-to-end-encrypted (E2EE) group calls use a *Selective Forwarding Unit* (SFU), which forwards encoded frames and does **not** transcode. With E2EE it *cannot* transcode, because it has no keys [60, 71, 72]. Authenticity through a forwarding relay is solved by frame-level E2EE plus signatures or MACs. Tolerating SFU layer-dropping (scalable video) was solved for streaming by 2010 [35]. True transcoding-tolerant authenticity has three options, and all fail for interactive calls:
   - Zero-knowledge proofs of correct re-encoding (Eva [88]) are roughly two orders of magnitude too slow on consumer hardware.
   - Perceptual or approximate hashes are adversarially breakable [78–80].
   - Watermark robustness has formal impossibility results [81].

   Direction A is therefore worth at most a *characterization* or poster. It is not a strong first paper.
2. **Direction B (deniable live-call authenticity) has real gaps, but they sit somewhere slightly different than the prompt assumes.** In a **2-party** call, deniable authenticity is essentially free: a MAC key shared by exactly two people cannot convince a third party (OTR's original insight [37]). The open problem is **group calls (≥3 parties) through an SFU**. Here the deployed systems openly *lack per-sender authentication*:
   - RFC 9605 (SFrame) has a section titled "No Per-Sender Authentication" [60].
   - Discord's DAVE whitepaper concedes that any group member can produce frames that appear to come from another sender [70].
   - Earlier SFrame signature modes were broken [63, 65].
   - Zoom's E2EE design allowed insider impersonation beyond its stated scope [66].

   This is directly relevant to multi-party deepfake fraud such as the Arup case, where every other "participant" was fake [26]. Fixing it with signatures destroys deniability. Fixing it with symmetric MACs runs into a known lower bound: compact, collusion-resistant multicast MACs essentially *are* signatures [36]. Deniable group authentication must be pairwise [43]. Timestamping receivers undermine "forgeable-later" schemes [45].
3. **The single best bet** is to formalize and build **per-sender, insider-resistant, loss-tolerant authentication for E2EE group calls, with an explicit evidence policy**: deniable by default, optionally reportable to a designated moderator. The paper would include:
   - a security model that captures the SFU, packet loss and timing;
   - a design-space result comparing pairwise vector-MACs, TESLA-style delayed key disclosure, and expiring signatures;
   - a browser prototype;
   - a lab demonstration of insider frame-forgery on a baseline SFrame-style stack the author controls.

   This is **combination-and-formalization novelty, not a new primitive.** Realistic venues are WPES (where OTR itself appeared), WOOT, ACNS, an FC workshop, a poster or the ACM Student Research Competition, with an IACR ePrint preprint first.
4. **Biggest honesty caveat:** for the "is that really the CFO?" problem, the decisive defense is **identity binding of keys plus per-sender authenticity**, not pixel provenance. Provenance shows which key or device produced a stream. It does not show that the face is real [8, 27], and verification ceremonies conducted over the audio/video channel can themselves be faked [69, 92].

# 1. Scope, method and search strategy

## 1.1 Research questions

- RQ1: What do existing provenance, stream-authentication, E2EE-media and deniability schemes guarantee in the **live, interactive, relay-mediated** setting?
- RQ2: Which combinations of properties are uncovered: real-time, interactive, untrusted relay, transcoding, loss, latency, per-sender authentication, evidence policy, identity binding, liveness and formal proof?
- RQ3: Which uncovered combination gives a realistic, defensible first publication for a supervised undergraduate with a browser + Node.js prototype?

## 1.2 Search method (this review used live web search, not recall)

- **Tools:** web search (standard and extended modes) and direct retrieval of arXiv abstract pages. The search surfaced primary listings from IACR ePrint, arXiv, DBLP, USENIX, NDSS, PoPETs, IEEE/ACM/Springer DOI landing pages, IETF Datatracker/RFC Editor, W3C TR, the C2PA specification site and GitHub, ITU-T, and the publication pages of authors and labs. Industry and vendor pages were used only for deployment facts and are labelled as secondary.
- **Query families (≈80 queries):**
  - provenance: AMP, C2PA live video/session keys, ONVIF media signing, H.274 digitally-signed-content, C2PA security analyses, live provenance with WebRTC;
  - deepfake defense: real-time challenge-response (GOTCHA, PITCH), active illumination, corneal reflection, Face Flashing, optical signatures, detector benchmarks, recapture/analog hole;
  - stream authentication: TESLA/EMSS, RFC 4082/4383, Gennaro–Rohatgi, Wong–Lam, Golle–Modadugu, surveys, SVC authentication, multicast-MAC lower bounds;
  - deniability: OTR, DAKEZ/ZDH, Signal deniability, mpOTR, epochal signatures, KeyForge/TimeForge, short-lived/time-deniable signatures, designated-verifier/UDVS, chameleon and ring signatures, real-world deniability, message franking (DGRW, AMF, Hecate);
  - E2EE real-time media: SFrame RFC and drafts, SFrame cryptanalysis, Zoom E2EE analyses, Discord DAVE, Signal group calls, Cloudflare Orange Meets, PERC, WebRTC identity, Encoded Transform, MLS;
  - transformation-tolerant authentication: Lin–Chang, AMAC, NeuralHash/PhotoDNA/PDQ attacks, watermark impossibility, Video Seal, PhotoProof, ZK-IMG, VerITAS, VIMz, Eva, Livepeer verification, TEE-attested transcoding;
  - SAS: Vaudenay, ZRTP, voice-imitation MITM, VOICE-ZEUS, fingerprint usability;
  - time: Haber–Stornetta, RFC 3161, ITU-T G.114;
  - novelty checks: "TESLA + SFrame/WebRTC", "deniable SFU/video call authentication", "franking for live media", "key-bound liveness challenge".
- **Verification labels used in the reference list:**
  - **[A]**: arXiv abstract page retrieved and read directly in this session.
  - **[S]**: bibliographic data and core claim confirmed from search results that quote primary listings (publisher/DBLP/ePrint/venue/RFC pages). The **full text was not read**.
  - **[S2]**: confirmed only from secondary sources (news, vendor blogs, aggregators).
  - **[UNVERIFIED]**: some detail (authors, venue, DOI, internals) could not be confirmed; the specific unconfirmed item is named.
- **Important limitation (please read):** this sandbox's network policy blocked direct fetches of several hosts, including `spec.c2pa.org`, `www.hhi.fraunhofer.de` and `show.ibc.org`. To stay within that policy I stopped trying additional publisher hosts and relied on search-result quotations plus arXiv. Consequently, **statements about the internals of papers, RFC sections and the C2PA spec beyond their abstracts or quoted snippets must be re-checked against the full text before you cite them.** Places where this matters most are flagged inline.

## 1.3 Working assumptions

- A1 (interactivity): "live call" means two-way, conversational use. ITU-T G.114 treats ≤150 ms one-way as preferred, and 400 ms as a planning upper bound. It also notes that highly interactive tasks can be affected below 100 ms [97].
- A2 (topology): 2 to ~50 participants, browser WebRTC clients, a media relay (SFU) controlled by a possibly malicious operator. Group key agreement is via MLS or an equivalent [74].
- A3 (prototype): laptop + phone over Wi-Fi, browser + Node.js, real webcam video, relay controlled by the author. All attacks are run only against the author's own deployment.

# 2. Taxonomy of the field

## 2.1 Threat taxonomy for "can I trust the face on this call?"

The literature mixes six distinct threats. Separating them is the first step to finding a real gap.

| ID | Threat | Example | What can stop it |
|---|---|---|---|
| T1 | **Outsider impersonation**: attacker joins as "the CFO" without the CFO's keys | Arup case: victim was the only real person on the call [26] | Identity-bound E2E keys + verification ceremony; **not** pixel provenance |
| T2 | **Malicious relay tampering** (in-path SFU/TURN rewrites, injects or replays media) | the author's attacker-in-the-middle tool | Frame-level E2EE (SFrame/DAVE/Zoom) [60, 70, 68] |
| T3 | **Malicious insider impersonates another participant** (often colluding with the SFU) | member forges "CFO" tile frames | **Per-sender authentication**, which is absent in RFC 9605 §7.2 [60] and DAVE [70]; insider impersonation in Zoom [66] |
| T4 | **Key-holder synthesizes content** (virtual camera, face swap of *themselves* or a stolen identity) | deepfake job candidates (FBI PSA) [25] | Liveness/challenge-response [17–21], attested capture [4], physical signals [13, 23]; crypto alone cannot solve this |
| T5 | **Post-call misuse of the recording** (leaks, coercion, framing, "prove what X said") | n/a | Evidence policy: non-repudiation (C2PA-like) vs deniability (OTR-like) vs designated reporting (franking) [37, 45, 55] |
| T6 | **Transformation by an intermediary** (MCU/gateway/broadcast transcodes) | call streamed to a CDN | Robust hashing (breakable), ZK proofs of transformation (slow), TEE attestation (trust shift) [78–88] |

**Key framing observation.** In the best-documented real incident (T1, Arup), the relay was not the adversary. The fake participants were simply other endpoints. Pixel provenance cannot help there, because the attacker's own device honestly signs synthetic pixels with the attacker's own key. What helps is:

- the victim's client *knowing* that the "CFO" tile is not authenticated by the CFO's identity key (identity binding plus per-sender authentication); and
- verification ceremonies that a real-time deepfake cannot pass (T1 meets T4).

## 2.2 Defense taxonomy

- **D1 Passive detection**: classifiers. They are weak in the wild [15, 16].
- **D2 Active challenge-response liveness**: behavioural, acoustic or optical challenges [17–21, 22].
- **D3 Capture provenance**: device-signed capture (C2PA, ONVIF, H.274 DSC, Pixel 10) [2, 4–6].
- **D4 Channel/stream authenticity**: stream signing, TESLA, frame E2EE, per-sender authentication [28–36, 60, 70].
- **D5 Identity binding and human verification**: PKI, SSO, key transparency, SAS/safety numbers [90–94].
- **D6 Transformation-tolerant authenticity**: robust hashes, AMAC, watermarks, ZK proofs, TEEs [75–89].
- **D7 Evidence policy**: non-repudiation, deniability, time-deniability, franking [37–57].
- **D8 Freshness/time**: TESLA time, timestamps, beacons, timing-based liveness [30, 95, 96, 21].

# 3. Per-area synthesis

## 3.1 Media provenance (AMP, C2PA, CAI/Project Origin, device and codec signing)

- **AMP** (England, Malvar, Horvitz et al., MMSys '21) [1]:
  - Publishers sign manifests for media, store them in a database, and register them in a permissioned ledger (Microsoft CCF). A browser then reports whether a verified manifest exists.
  - The paper explicitly argues that *detection is destined to fail*, which motivates provenance.
  - Setting: stored media, publisher-side signing, public verification (non-repudiation by design), no transcoding tolerance beyond re-registration. AMP fed into C2PA [1].
- **C2PA**:
  - The specification reached v2.3 (document dated 2026-01-05; release announced 22 Jan 2026), then 2.4 and 2.5 [2, 3].
  - v2.3 added a **Live Video** section (§19) for content packaged in **ISO BMFF/CMAF**. MPEG-TS is not supported [2].
  - Two methods [2]:
    1. a per-segment C2PA manifest box chained by the previous segment's manifest ID, with sequence numbers and a stream ID;
    2. **Verifiable Segment Info** (VSI): the manifest sits in the init segment; a `c2pa.session-keys` assertion binds short-lived asymmetric session keys (e.g., Ed25519) to the manifest signer; each media segment carries a small COSE_Sign1 record in an `emsg` box.
  - Session keys carry a validity period. One SDK defaults to 24 h. On expiry the signer emits a new init segment. [S2 via vendor docs; re-check §19.4 text.]
  - v2.5 generalizes "live video" to "live media" [2].
  - Typical segment durations are **1–10 s** (vendor and SVTA material), so verification granularity is **seconds**. This suits HLS/DASH broadcast, not RTP/WebRTC calls [S2].
  - A granted US patent describes the same pattern: a short-lived live-stream key certified by a long-term key [12] (assignee UNVERIFIED).
- **Live deployments and proposals:**
  - Broadcast vendors (Unified Streaming, EZDRM, Irdeto, Qualabs toolkit) [S2].
  - A proposal for an IBC 2026 session by Fluendo to carry signatures *inside the H.264/H.265/H.266 bitstream* using ITU-T H.274 "Digitally Signed Content" SEI messages, specifically to support **WebRTC ingestion** [6, 7] (title-level only; content UNVERIFIED).
  - The H.274 DSC mechanism uses three SEI messages: initialization, substream selection and verification (DSCI/DSCS/DSCV). It was developed in JVET [6]. Inclusion in a specific H.274 edition is UNVERIFIED.
- **Surveillance:** ONVIF's Media Signing add-on (v26.06, release candidate; final expected end of 2026) and Axis's open-source Signed Video put a signed "signing document" in **SEI frames**. That document holds hashes of all frames since the previous signing occasion [5]. Setting: live, one-way, device-signed, GOP-level granularity, non-repudiable.
- **Capture attestation:** the Pixel 10 camera app reached C2PA **Assurance Level 2** for *still photos* (September 2025) [4]. Hardware details (Tensor G5/Titan M2/key attestation) appear only in secondary reports [S2]. No attested-capture standard for *live call* video was found.
- **Critiques (important):**
  - Golaszewski, Krawetz, Sherman et al. (arXiv 2604.24890 / ePrint 2026/804, April 2026; a short whitepaper summarising a longer study; **not peer reviewed**) report what they call the first comprehensive independent security analysis of C2PA, including formal methods. They conclude that the specs **do not achieve their claimed security goals** and should not yet be used for high-stakes purposes [8]. Search-result summaries of the longer document mention timestamp replacement and verification-privacy issues. Re-check these against the full text.
  - Nemecek, He, Cheng and Ayday (CVPR 2026 workshop) show an "Integrity Clash": a valid C2PA manifest claiming human authorship can coexist with a pixel watermark saying "AI-generated", with no cryptography broken [9].
  - Privacy tension: redaction is supported but weakens evidentiary value [11]. Zero-knowledge "soft redaction" proposals are appearing [10].
- **Threat model summary:** the signer is the capture device or tool, verification is public, the guarantee is *integrity since signing* plus signer identity. It is **not** a truth claim (see §3.2). Evidence policy is **non-repudiation by design**. **No profile for interactive RTP/WebRTC calls was found.**

## 3.2 Deepfake defense: detection vs provenance

- **Passive detection is brittle in the wild.** Deepfake-Eval-2024 (arXiv 2503.02857) reports that open-source detectors' AUC drops by about **50% (video), 48% (audio) and 45% (image)** relative to earlier benchmarks. Commercial and fine-tuned models still trail human forensic analysts [16]. A survey baseline: Mirsky & Lee, ACM CSUR [15].
- **Active, interactive challenge-response targets live calls specifically:**
  - GOTCHA (EuroS&P 2024) gives randomized tasks to a suspected impostor. Reported AUC is 88.6% with human evaluators and 80.1% with the automated scorer [17].
  - PITCH (ASIA CCS 2025) uses audio challenges: 88.7% AUROC for machines; a human–AI combined accuracy of 84.5% on a hard subset [18].
  - Optical challenges:
    - Gerstner & Farid modulate the screen and check the face's illumination response (CVPRW 2022) [19].
    - Guo, Wang & Lyu check corneal reflections of an on-screen pattern [20].
    - Face Flashing (NDSS 2018) flashes random colours and relies on a *timing* gap between genuine reflection and forgery [21].
    - LiveScreen uses skin reflection in video chat [22] (venue UNVERIFIED).
  - All are **heuristic, empirical** defenses with no cryptographic binding to the session keys.
- **Physical-layer provenance:**
  - VeriLight (CCS '25) embeds cryptographically secured optical signatures of identity and facial-motion features into the scene light during *live speeches* (one-way). Verification happens later [13].
  - Noise-coded illumination (ACM TOG 2025) codes room lights so later forensic analysis can detect manipulation. Verification requires the secret codes [23].
- **Limits of provenance (provenance ≠ truth):**
  - A signed camera faithfully signs a *recaptured* screen showing a deepfake (the analog hole). Researchers have demonstrated signed-then-edited and recapture problems. Commentators repeatedly note that C2PA was "not intended as a fact-checking tool" [27, S2].
  - Virtual-camera injection is the T4 path for calls. Metadata-based ML detection of it is only now being studied (arXiv 2512.10653) [24].
- **Incidents grounding the problem:**
  - Arup, Hong Kong, 2024: HK$200M (≈US$25.6M) transferred in 15 transfers after a multi-person deepfake video conference [26, S2].
  - FBI IC3 PSA I-062822-PSA (28 June 2022) on deepfakes in remote job interviews [25].

## 3.3 Stream and broadcast authentication

- **Signature amortization:**
  - Gennaro–Rohatgi (CRYPTO '97; journal version 2001) give offline hash-chaining for known streams and online one-time-signature chaining [28].
  - Wong–Lam (IEEE/ACM ToN 1999) sign the root of a Merkle tree over a block of packets. Each packet carries its authentication path, so every received packet is individually verifiable [29].
- **Loss tolerance:**
  - Golle–Modadugu (NDSS 2001) handle bursty and random loss [33].
  - **EMSS** (Perrig, Canetti, Tygar, Song) uses redundant hash links plus periodic signatures. It gives non-repudiation, high loss resistance and slightly delayed verification [30].
  - Challal et al. survey and classify the area [34].
- **TESLA** [30, 31]:
  - Uses symmetric MACs with a one-way key chain and **time-delayed key disclosure**. Asymmetry comes from time: when a packet arrives, its key is still secret, and receivers check a loose time-synchronization "safety condition".
  - Properties: strong loss robustness, tiny per-packet cost, delayed verification.
  - RFC 4082 notes that **TESLA alone does not provide non-repudiation** to third parties [31].
  - **RFC 4383 (2006) already specifies TESLA inside SRTP** for multicast/broadcast data-origin authentication. Bootstrapping is out of scope [32].
- **Lower bound (crucial for Direction B):** Boneh, Durfee and Franklin (EUROCRYPT 2001) prove that one cannot build a short, efficient, **collusion-resistant multicast MAC** without a new advance in signature design. Practical schemes beat the bound only via **timing assumptions** (TESLA) [36].
- **Scalable video:**
  - Mokhtarian & Hefeeda (IEEE TMM 2010) authenticate H.264/SVC streams so that *every extractable substream* (temporal, spatial or quality layer dropped by an intermediary) verifies. They released `svcAuth` [35].
  - This already covers "the relay drops layers" for streaming.
- **Modern descendants:** C2PA live (segment-level) [2], ONVIF/Axis (GOP-level SEI) [5], H.274 DSC (picture/substream-level SEI) [6].
- **Settings covered:** one-way multicast/broadcast, untrusted network, loss tolerance, proven or analysed unforgeability.
- **Not covered:** interactive group membership changes (continuous group key agreement (CGKA) epochs), insider receivers *who are also senders*, an adversarial relay that schedules packets to break timing assumptions, and deniability.

## 3.4 Deniable authentication and off-the-record

- **Foundations:**
  - OTR (WPES 2004) uses deniable authenticated key exchange plus MACs, and **publishes old MAC keys** so transcripts become forgeable [37].
  - Bonneau et al.'s finite-state analysis of OTRv2 notes that implementations publish only receiving-side MAC keys, which weakens the strong-deniability claim [38] (venue UNVERIFIED).
- **Deniable AKE:**
  - Unger & Goldberg: CCS 2015 (security in the generalized UC framework) and PoPETs 2018 (DAKEZ, ZDH, XZDH). These cover *online* vs *offline* deniability; DAKEZ gives strong deniability for synchronous settings in about 1 ms of CPU and ≤464 bytes [39, 40].
  - Signal's X3DH: deniability proofs need strong assumptions; MQV can be non-deniable in some groups [41].
- **Groups:**
  - mpOTR (CCS 2009) [42].
  - Schliep & Hopper (WPES 2019) argue that a **deniable group message-authentication primitive is impossible** (as they define it). They use pairwise authentication instead, and note that MLS explicitly does not target deniability [43].
  - Hülsing & Weber (IEEE S&P 2021) give **epochal signatures** that make signature-based group chats deniable after an epoch [44].
  - The MLS Architecture RFC 9750 has a section on "Non-Repudiation vs. Deniability" [53].
- **Forgeable-later signatures:**
  - KeyForge/TimeForge (USENIX Security 2021) make email signatures forward-forgeable (keys are published after a delay). The authors note that the basic TimeForge lacks *recipient* non-attributability against real-time attackers, so they add per-recipient variants. They also state that **deniability against a global attacker is impossible for past timestamps** [45].
  - Short-lived ZK proofs and signatures based on verifiable delay functions (VDFs) (ASIACRYPT 2022) [46] and **time-deniable signatures** (PoPETs 2023) give authenticity for a signer-chosen period, after which anyone can forge [47].
- **Designated-verifier family:**
  - Designated-verifier proofs from trapdoor commitments (EUROCRYPT '96) [48].
  - **UDVS** (ASIACRYPT 2003): a holder of an ordinary signature can convert it into one only a chosen verifier accepts. This is a natural bridge from a C2PA-style device signature to a deniable proof. Vergnaud later showed the original scheme is delegatable [49].
  - Chameleon signatures (NDSS 2000) [50] and ring signatures (ASIACRYPT 2001) [51].
- **Real-world check:** Collins, Colombo & Huguenin-Dumittan (PoPETs 2025) model deniability at the *system* level. They find Signal and DKIM-email offer no practical deniability, and that **none of 140 Swiss court cases** using messaging evidence considered deniability [52]. This is a serious motivation risk for any "deniable calls" paper (§7).
- **Accountability counterpart (franking):**
  - Dodis–Grubbs–Ristenpart–Woodage (CRYPTO 2018) broke Facebook's franking of **image/video attachments**: AES-GCM is not committing ("invisible salamanders"), so an abuser can make reports show benign content. They also introduce encryptment [54].
  - **Asymmetric message franking** (CRYPTO 2019) gives deniability to everyone except a designated moderator [55]. Hecate (USENIX Security 2022) adds forward/backward secrecy and source tracing [56]. A SoK covers E2EE moderation [57].
  - **No franking or reporting scheme for live call audio/video frames was found.**

## 3.5 End-to-end-encrypted real-time video

- **WebRTC baseline:**
  - DTLS-SRTP is hop-by-hop when an SFU is present.
  - RFC 8827 defines an identity-provider (IdP) mechanism to bind DTLS fingerprints to identities [58]. The W3C later moved the identity framework to a separate spec, and Mozilla closed the related bug WONTFIX. Practical browser deployment appears negligible (Chrome status UNVERIFIED).
- **PERC** (RFC 8871, 2021): a "Media Distributor" without E2E keys does per-hop authentication; endpoints share E2E keys [59]. IETF discussion notes that PERC (and SFrame) let participants impersonate each other because they use MACs, not signatures [60, S].
- **SFrame** (RFC 9605, Aug 2024):
  - Lightweight frame-level authenticated encryption for SFU calls, used through the W3C **Encoded Transform** API (Working Draft, Dec 2025) [60, 73].
  - §7.2 is titled **"No Per-Sender Authentication"**: with symmetric keys, any group member can produce traffic that appears to come from another [60].
  - Early drafts (draft-omara-sframe-01/-03) had a signature mode over authentication tags [61]. **Isobe, Ito & Minematsu (ESORICS 2021)** found forgery and authentication-key-recovery attacks. These include **impersonation by a malicious member** via the AES-CM-HMAC construction with short tags [63, 64].
  - **Shiraki, Kimura & Isobe (JIP 2024)** report that many attacks still apply to draft-ietf-sframe-enc-03 when the same signature process is used [65].
  - draft-barnes-sframe-mls derives per-sender keys from the MLS exporter. It states these **do not** authenticate senders (any member can derive them) and that per-sender authentication exists only with signatures [62].
- **Zoom E2EE:**
  - Whitepaper with device signing keys and a leader-signed participant list [67]. **Frame-level signing details UNVERIFIED.**
  - Isobe & Ito (ACISP 2021 / IEEE Access; ePrint 2021/486) show insiders colluding with participants can impersonate *any* Zoom user in target meetings, beyond the whitepaper's stated scope [66].
  - Dodis, Jost, Kesavan & Marcedone (EUROCRYPT 2023) prove the core continuous group key agreement secure (a "leader-based CGKA with liveness" notion) and deployed a liveness fix (v5.13) [68].
  - **VOICE-ZEUS** (arXiv 2023) impersonates the spoken security-code ceremony by reordering recorded digits [69].
- **Discord DAVE** (2024, v1.1):
  - MLS plus per-sender ratcheted frame keys via Encoded Transform; voice-privacy codes for out-of-band comparison; Trail of Bits audit [70].
  - The whitepaper states per-sender keys exist to avoid key/nonce collisions, **not for sender authentication**, "since any member of the group can derive the key for any sender". It concedes members can produce frames that appear to come from another sender [70].
- **Signal** uses its own open-source SFU for E2EE group calls [71]. Per-sender authentication of frames is UNVERIFIED here.
- **Cloudflare Orange Meets** (June 2025) adds client-side MLS E2EE over an unmodified SFU, a "designated committer" algorithm checked with TLA+, and safety numbers [72]. Per-sender frame authentication is UNVERIFIED.
- **Takeaway:** for outsiders and the relay (T2), deployed E2EE is mature. For **insiders (T3), per-sender authenticity is absent by design in the reference standard and at least one major deployment.** The one standardized attempt (signatures over tags) was broken [63, 65].

## 3.6 Robust/perceptual hashing, approximate authentication, transformation proofs

- **Content-based signatures:** Lin & Chang (TCSVT 2001) sign DCT-coefficient relationships that survive JPEG requantization [75].
- **Approximate MACs:** Graveman–Fu; Xie–Arce–Graveman (IEEE TMM 2001); Di Crescenzo, Graveman, Ge & Arce (2005, formal model). These are noise-tolerant MACs [76, 77].
- **Attacks on perceptual hashing** (decisive for feasibility):
  - NeuralHash collisions and evasion (FAccT 2022) [78];
  - >99.9% black-box evasion of perceptual-hash client-side scanning (USENIX Security 2022) [79];
  - attacks on PhotoDNA and PDQ (USENIX Security 2023) [80].
  - Any scheme that accepts "perceptually close" content gives the adversary a perturbation budget. Adversarial ML shows that budget is usable.
- **Watermarks:** Video Seal is robust to codecs in practice [82]. "Watermarks in the Sand" (ICML 2024) proves strong watermarking is impossible under natural assumptions, even with a private detection key [81].
- **ZK proofs of permissible transformations:**
  - PhotoProof (S&P 2016) [83] and ZK-IMG (preprint 2022) [84].
  - VerITAS (S&P 2025): 30-MP images, ~13 min of proving for a weak signer, ~3 min for a strong one [85]. HyperVerITAS (PoPETs 2026) [86]. VIMz (PoPETs 2025) [87].
  - **Eva (S&P 2025)** is the first protocol for **lossily encoded (H.264) video** with arbitrary edits. It produces a 448-byte proof in **~2.4 h on consumer hardware, ~2.6 µs per pixel** (the preprint reports ~2.5 h for a 1-min HD 30 fps clip) [88].
  - *Back-of-envelope (my arithmetic):* 1080p30 is ~62 Mpx/s. At 2.6 µs/px, that is ~160 s of proving per second of video, so ~**2 orders of magnitude** short of real-time throughput. Interactive *latency* (proof per frame in ≪100 ms) is further still. GPU work (VIMz-Loua, 2026 preprint) narrows but does not close this [S].
- **Verification of untrusted transcoders in practice:** Livepeer uses ML/computer-vision checks (Andujar et al., ICIAR 2020) and trusted/untrusted orchestrator lists. These are probabilistic, not cryptographic [89].
- **TEE-attested transcoding:** no paper combining TEE-attested transcoding with C2PA-style manifests for live video was found. Note that this approach shifts trust to the TEE vendor.
- **Verdict for Direction A:** transcoding-tolerant, publicly verifiable, real-time E2E authenticity is out of reach. Moreover, *E2EE calls never need it*, because E2EE SFUs cannot transcode. It matters for broadcast/CDN pipelines, where C2PA re-signs at the packager and ZK work (Eva) is the research frontier.

## 3.7 Short authentication strings and human key verification

- **Theory and protocol:**
  - Vaudenay (CRYPTO 2005): message authentication over a weak channel that authenticates only ~15-bit strings; the protocol is optimal and uses extractable/equivocable commitments [90].
  - ZRTP (RFC 6189, 2011) does Diffie–Hellman in the media path, and users compare the SAS by voice [91].
- **Attacks on human verification over the media channel:**
  - Shirvanian & Saxena (CCS 2014; JCS 2018) show **short voice-imitation MITM attacks** against crypto-phone SAS, defeating both human and automated checks; shorter SAS are more vulnerable [92].
  - VOICE-ZEUS does the same against Zoom's E2EE security-code ceremony by reordering recorded digits [69].
  - Fingerprint comparison usability varies widely: attack success ranged from 6% to 72% across representations in a 661-participant study (CHI 2017) [93]. See also SOUPS 2017 [94].
- **Deployed ceremonies:** DAVE voice-privacy codes [70], Orange Meets safety numbers [72], Zoom security codes [67].
- **Gap:** in the deepfake era, *the ceremony's channel is the very channel being forged* (T1 + T4). No ceremony was found that binds the SAS to a physical liveness challenge (§5, G5).

## 3.8 Liveness, anti-replay, freshness and timestamping

- Haber–Stornetta (J. Cryptology 1991) introduced linked timestamping [95]. RFC 3161 timestamp authorities are what C2PA uses [96, S2]. Search summaries of [8] report that C2PA timestamps can be swapped (re-check).
- TESLA provides intrinsic freshness via its time-safety check [30].
- Face Flashing derives security from a *timing gap* [21]. This is conceptually similar to TESLA's time asymmetry, but over a physical channel.
- KeyForge notes that past timestamps limit what deniability can achieve [45]. This matters directly to any "forgeable later" live-call design (§6, Candidate 1 risks).

# 4. Comparison matrix

Legend:

- **Setting:** S = stored; LS = live, segmented (seconds); RT = real-time frames/packets.
- **Int:** interactive two-way (Y/N).
- **Relay:** U-fwd = untrusted forwarder; U-tx = untrusted transformer; T = trusted.
- **Tx:** transform tolerance. ✗ none; L = layer/packet dropping; ◐ limited (codec noise); ✓ = proven permissible transforms.
- **Loss:** loss tolerance.
- **Lat:** verification latency. ~0 = immediate; d = disclosure delay; seg = segment (s); off = offline; h = hours.
- **Ins:** per-sender authenticity against other members. n/a = single sender or 2-party.
- **Evid:** NR = non-repudiable; Den = deniable; Den(T) = deniable after time T; Fr = reportable to a designated party.
- **ID:** identity binding.
- **Live:** addresses "is the face real/live".
- **Proof:** F = formal; H = heuristic/empirical; Sp = specification/audit only.
- **?** = not verified in this review.

**Table 4a: provenance, stream authentication, transformation-tolerant schemes**

| System | Setting | Int | Relay | Tx | Loss | Lat | Ins | Evid | ID | Live | Proof |
|---|---|---|---|---|---|---|---|---|---|---|---|
| AMP [1] | S | N | T(ledger) | ✗ | n/a | off | n/a | NR | publisher PKI | ✗ | Sp/H |
| C2PA stored [2] | S | N | any | ✗ hard / ◐ soft | n/a | off | n/a | NR | X.509 | ✗ (◐ with attested capture) | Sp (gaps per [8]) |
| C2PA 2.3 Live: manifest box [2] | LS (1–10 s) | N | U-fwd | ✗ | ◐ (chain) | seg | n/a | NR | X.509 | ✗ | Sp |
| C2PA 2.3 Live: VSI session keys [2] | LS | N | U-fwd | ✗ | ◐ | seg | n/a | NR | X.509 + session keys | ✗ | Sp |
| ONVIF / Axis signed video [5] | RT/LS (GOP, SEI) | N | U-fwd/storage | ✗ | ◐ | GOP | n/a | NR | device cert | ◐ device | Sp |
| H.274 DSC (+ WebRTC ingest proposal) [6, 7] | RT (substreams) | N | U-fwd | L? | ? | picture/substream | n/a | NR | X.509 | ✗ | Sp |
| VeriLight [13] | live capture, later check | N | n/a | ◐ (physical) | ? | off | n/a | ? | event operator | ✓ physical | H |
| GOTCHA / PITCH [17, 18] | RT | Y | n/a | n/a | n/a | seconds | n/a | none | none | ◐ | H |
| Active illumination / Face Flashing [19–21] | RT | Y | n/a | ✓ (physical) | ◐ | seconds | n/a | none | none | ◐ | H |
| Noise-coded illumination [23] | capture, later check | N | n/a | ◐ | ? | off | n/a | code holder | none | ◐ | H |
| Gennaro–Rohatgi [28] | RT | N | U | ✗ | ✗ | ~0 | ✓ | NR | PKI | ✗ | F |
| Wong–Lam tree [29] | RT | N | U | ✗ | ✓ | block | ✓ | NR | PKI | ✗ | H |
| EMSS [30] | RT | N | U | ✗ | ✓ (probabilistic) | sig delay | ✓ | NR | PKI | ✗ | H/analysis |
| TESLA / RFC 4082 [30, 31] | RT | N | U | ✗ | ✓ | d | ✓ (time sync) | no NR (≈Den offline) | signed anchor | ✗ | F (later work) |
| TESLA in SRTP, RFC 4383 [32] | RT (RTP) | N (multicast) | U | ✗ | ✓ | d | ✓ | no NR | bootstrap out of scope | ✗ | Sp |
| SVC authentication [35] | RT/stream | N | U-tx (L) | L | ✓ | short | ✓ | NR | PKI | ✗ | H/analysis |
| Perceptual hash / AMAC [75–80] | S/RT | N | U-tx | ◐ | ✓ | ~0 | ✗ (symmetric) | varies | varies | ✗ | F defs; attacked |
| Watermarks (Video Seal) [81, 82] | S/RT | N | U-tx | ◐ | ✓ | ~0 | n/a | detector key | none | ✗ | H; impossibility [81] |
| PhotoProof / VerITAS / VIMz [83–87] | S (images) | N | U-tx | ✓ | n/a | minutes | n/a | NR (VIMz: anonymous) | camera cert | ◐ (assumes attested camera) | F |
| Eva [88] | S (lossy video) | N | U-tx | ✓ | n/a | h | n/a | NR | camera cert | ◐ | F |

**Table 4b: E2EE real-time media, deniability/accountability, SAS**

| System | Setting | Int | Relay | Tx | Loss | Lat | Ins | Evid | ID | Live | Proof |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DTLS-SRTP peer-to-peer [58] | RT, 2-party | Y | none/TURN | ✗ | ✓ | ~0 | n/a (2-party) | content ≈Den; handshake signed | SDP fingerprint (IdP not deployed) | ✗ | F (DTLS) |
| PERC [59] | RT | Y | U-fwd | ✗ | ✓ | ~0 | ✗ | symmetric | Key Distributor | ✗ | Sp |
| SFrame RFC 9605 [60] | RT | Y | U-fwd | L (frame drop) | ✓ | ~0 | **✗ (§7.2)** | symmetric | external | ✗ | Sp; attacked [63, 65] |
| SFrame signature mode (drafts) [61, 63, 65] | RT | Y | U-fwd | ✗ | ◐ | batch | intended ✓, **broken** | NR | MLS/PKI | ✗ | Sp, attacked |
| Discord DAVE [70] | RT | Y | U-fwd | ✗ | ✓ | ~0 | **✗ (conceded)** | symmetric media; MLS signed handshake | voice-privacy code | ✗ | Sp + audit |
| Zoom E2EE [66–68] | RT | Y | U-fwd | ✗ | ✓ | ~0 | ✗/◐ ([66]) | ? | device keys, leader-signed list | ✗ | F for CGKA core [68] |
| Orange Meets [72] | RT | Y | U-fwd | ✗ | ✓ | ~0 | ? (likely ✗) | ? | safety number | ✗ | TLA+ (committer) |
| OTR / DAKEZ [37, 40] | messages | Y | U | n/a | ✗ | ~0 | n/a (2-party) | Den (online/offline variants) | key verification | ✗ | F |
| mpOTR / Mobile CoWPI [42, 43] | group messages | Y | U | n/a | ✗ | ~0 | ✓ (pairwise) | Den | key verification | ✗ | F |
| Epochal signatures [44] | group chat | Y | U | n/a | ✗ | ~0 | ✓ in epoch | Den after epoch | PKI | ✗ | F |
| KeyForge / TimeForge [45] | email | N | U | n/a | n/a | ~0 | ✓ (window) | Den(T); limited by timestamps | DKIM/DNS | ✗ | F |
| Time-deniable / short-lived signatures [46, 47] | messages | N | n/a | n/a | n/a | ~0 | ✓ until T | Den(T) | PKI | ✗ | F |
| UDVS / designated-verifier [48, 49] | messages | N | n/a | n/a | n/a | ~0 | ✓ | Den (to non-designated) | PKI | ✗ | F |
| AMF / Hecate [55, 56] | messages | Y | U platform | n/a | ✗ | ~0 | ✓ | Fr + Den to others | moderator keys | ✗ | F |
| ZRTP / SAS [90, 91] | RT, 2-party | Y | U | ✗ | ✓ | ~0 | n/a | ≈Den | human SAS (voice-attackable [92]) | ✗ | F [90] |
| **Target (gap)** | **RT, group** | **Y** | **U-fwd** | **L** | **✓** | **≲100–200 ms** | **✓** | **Den by default, optional Fr** | **verified keys + deepfake-robust ceremony** | **◐ (liveness bound to keys)** | **F + prototype** |

# 5. Gap list for the live / interactive / relayed setting

- **G1: Per-sender (insider-resistant) frame authentication in SFU-relayed E2EE group calls.**
  - Absence is explicit in RFC 9605 §7.2 [60] and DAVE [70]. The derived-key approach is explicitly non-authenticating [62]. The drafted signature mode was broken [63, 65]. Zoom permitted insider impersonation [66].
  - **No formally analysed, loss-tolerant, latency-bounded construction for this setting was found.**
  - Classic multicast authentication (TESLA, EMSS, RFC 4383) targets one-to-many broadcast without CGKA epochs, and without an adversarial relay that schedules packets.
- **G2: Evidence policy for live media.**
  - No scheme was found that gives *in-call* per-sender authenticity **and** *post-call* deniability for media frames.
  - No franking or designated-reporting scheme for live call media was found. Messaging franking exists [54–56], and media attachments were exactly where franking broke [54].
- **G3: Security definitions for real-time group media authenticity.** Existing definitions do not jointly model: loss/reordering; SFU delay, drop or reorder as an adversarial scheduler; layer dropping; join/leave epochs; insiders; and a judge or timestamping service (for deniability). Stream-authentication definitions predate CGKA, and deniability definitions assume reliable message delivery.
- **G4: No interactive-call profile for C2PA.** C2PA live covers ISO BMFF segments of 1–10 s [2]. The only WebRTC-oriented proposal found is one-way *ingestion* via H.274 DSC [6, 7].
- **G5: Verification ceremonies robust to real-time synthesis.** SAS read aloud or shown on camera is spoofable [69, 92]. Illumination-based liveness [19–22] is not bound to the key exchange. No "key-bound liveness challenge" was found. This was a targeted search, so it is moderately reliable.
- **G6: Transcoding-tolerant E2E authenticity at interactive latency.** Infeasible today (§3.6). Architecturally avoidable for calls. A real gap for broadcast, where work is active (Eva, VIMz-Loua).
- **G7: Attested live capture bound to call keys** (against T4 virtual-camera injection). Attestation exists for stills (Pixel 10 [4]) and surveillance cameras [5]. No call-oriented standard was found.
- **G8: TESLA-style timing assumptions under an adversarial SFU** (delay to push packets past disclosure; manipulation of time-sync). Not analysed for this setting (inference from [30–32]; not directly searched in depth).
- **G9 (tentative): usability of frame-level "verified/pending/unverified" indicators** with delayed verification. Not searched in depth.
- **G10: Does deniability for calls matter in practice?** [52] suggests messaging deniability is ignored in courts. Whether this differs for video is an open empirical question.

# 6. Candidate contributions (ranked by novelty × small-team feasibility × crypto depth)

## Candidate 1 (best bet): "Who sent that frame?" Per-sender authenticity vs deniability for E2EE group calls

**Precise claim.** For SFU-relayed E2EE group calls, define security notions for:

- (i) per-sender frame unforgeability against a coalition of the relay plus any subset of other participants, under loss, reordering and adversarial scheduling;
- (ii) bounded verification delay;
- (iii) an explicit evidence policy: offline deniability, and optionally designated reportability.

Then:

1. Show a design-space **trilemma** for o(n)-size authenticators: insider unforgeability, deniability against a receiver with trusted time, and compactness cannot all hold.
2. Instantiate three constructions, each above SFrame, with proofs:
   - (a) a **pairwise vector-MAC** per frame. It is insider-resistant and strongly deniable, with Θ(n) overhead. It is Schliep–Hopper's pairwise insight [43] applied to frames.
   - (b) **TESLA-over-SFrame** with a deniably-authenticated chain anchor. It is compact and insider-resistant given time sync, deniable offline only, with verification delay d [30–32, 40].
   - (c) **expiring per-epoch signing keys**, KeyForge/epochal-style [44, 45]. Compact, no verification delay, deniable after the epoch.
3. Measure all three in a browser prototype, and demonstrate the insider-forgery attack on a baseline SFrame-style stack the author controls.

**Why it is novel (and against what):**

- RFC 9605 §7.2 [60], the DAVE whitepaper [70] and draft-barnes-sframe-mls [62] leave per-sender authentication open or optional.
- The drafted signature mode was attacked [63, 65]. A key lesson to formalize: **never sign or MAC a short or non-collision-resistant AEAD tag under a key insiders know.** Authenticate a collision-resistant hash of header and ciphertext instead. This is the same family of failure as non-committing GCM in franking [54].
- RFC 4383 [32] uses TESLA in SRTP for *multicast* with no group-call epochs, insider senders, deniability or adversarial SFU analysis.
- KeyForge [45], epochal signatures [44] and time-deniable signatures [47] target email or chat, not lossy real-time media.
- BDF 2001 [36] and Schliep–Hopper [43] supply the lower-bound and impossibility *ingredients*. Translating them into a real-time media model, with time and loss, is the formalization contribution.

**Hardest technical risks:**

1. **"Obvious combination" objection.** Reviewers may say this is just KeyForge or TESLA applied to frames. The mitigation is the model (an SFU as adversarial scheduler, loss, epochs, judge with trusted time), the trilemma theorem, the broken-baseline lesson, and real measurements.
2. **The timing trap.** Any scheme where receivers *cannot* forge at time *t* lets a receiver timestamp what they received (e.g., with an RFC 3161 timestamp authority) and later convince a judge. Insider-resistant compact schemes are therefore at best **offline-deniable against judges without trusted time**. KeyForge already acknowledges the past-timestamp limit [45]. Only per-receiver (pairwise or designated-verifier) authenticators survive this, and they pay Θ(n) size, which BDF [36] suggests is unavoidable for symmetric schemes. **This is the core theorem to state and prove carefully.**
3. **TESLA under an adversarial SFU.** The relay can delay packets past disclosure. That is a DoS, not a forgery, but it must be modelled. Clock-offset bootstrapping through the relay must also be safe. A "play-then-verify" UI leaves a d-length window of unverified display.
4. **Bootstrap leaks participation.** MLS credentials are signatures [53, 74], so anchors authenticated via MLS prove *participation*, not content. Full deniability needs a deniable AKE (e.g., DAKEZ-style [40]) pairwise at join, which costs O(n).
5. **The content itself is evidence.** A recording of a face speaking is non-cryptographic evidence. The paper must claim only "no *cryptographic* evidence beyond the plaintext". In the deepfake era, plaintext video is cheap to fabricate, so the claim still has bite.
6. **Equivocation.** Pairwise MACs let a malicious *sender* show different content to different receivers. DAVE's own spec notes this class of issue [70]. State it as a separate "transcript consistency" property.

**Minimal defensible result:**

- (a) a threat model and game-based definitions (sketch in Appendix A);
- (b) a trilemma statement with proof, or a clearly scoped conjecture plus a proof for a restricted class;
- (c) constructions (a)–(c) with reductions to PRF/MAC unforgeability, hash-chain one-wayness, EUF-CMA and deniable-AKE security;
- (d) a prototype: WebRTC Encoded Transform worker, AES-GCM SFrame-like layer, HMAC-SHA-256, and Ed25519 (WebCrypto where supported, otherwise a vetted library), running on the author's existing Node relay with 2–8 participants on laptop and phone;
- (e) an evaluation: per-frame CPU, bytes per frame, verification-delay distribution, behaviour under 1–20% loss and SFU delay attacks, and the insider-forgery demonstration (with screenshots);
- (f) a responsible framing: only against the author's own deployment.

Back-of-envelope overheads (my arithmetic, 30 fps):

| Construction | Overhead per frame | Bitrate per sender |
|---|---|---|
| Ed25519 signature | 64 B | ≈15 kbps |
| TESLA (16-B tag + 32-B disclosed key) | ≈48 B | ≈12 kbps |
| Pairwise vector-MAC, 16-B tags, n = 5 | 64 B | ≈15 kbps |
| Pairwise vector-MAC, 16-B tags, n = 10 | 144 B | ≈35 kbps |

All are small next to typical video bitrates, so feasibility is good.

**Venues:** IACR ePrint (preprint) → **WPES** (privacy/deniability; OTR [37] and Mobile CoWPI [43] appeared there), **WOOT** (if attack-heavy; WOOT '26 had an "up-and-coming" track [S]), **ACNS** (applied crypto), FC workshops, CCS/NDSS poster sessions, the ACM Student Research Competition. A main-track crypto venue is unrealistic for a first paper.

## Candidate 2: "Reportable but deniable": designated-moderator franking for live call media

**Claim.** The first franking-style scheme for live media. A receiver can prove to a *designated* moderator (platform trust-and-safety, or a corporate security team, e.g., in a deepfake-fraud investigation) that a segment of a call came from sender X. Nobody else can be convinced. Selective disclosure of a short window (e.g., 5 s), amortized per-segment authentication over Merkle roots, committing encryption.

**Novelty basis:** AMF [55] and Hecate [56] cover messages. DGRW [54] shows media is where franking broke. Searches found no live-media franking (§3.4).

**Hardest risk:** combining AMF's cost with 30 fps (needs amortization) without breaking deniability or loss tolerance; key management for moderators; motivation (who is the moderator in a cross-organization call?).

**Minimal result:** definitions (accountability, deniability, confidentiality), a construction from AMF/Hecate primitives plus per-segment Merkle roots, a proof sketch, prototype integration with Candidate 1, and an evaluation.

**Venues:** WPES/ACNS realistic; PoPETs ambitious.

**Best done as an extension section of Candidate 1** (deniable-by-default + reportable).

## Candidate 3: attack and measurement study of insider impersonation and ceremony spoofing in open-source E2EE call stacks

**Claim.** Demonstrate, in the author's own deployments of open-source stacks (e.g., an SFrame/MLS client such as Orange Meets' open-source code, Jitsi E2EE, a libdave-based client), two things:

- (a) **insider + relay frame injection** attributed to another participant; and
- (b) **real-time voice/video spoofing of verification ceremonies**, extending VOICE-ZEUS [69] and Shirvanian–Saxena [92] from recorded-digit splicing to live voice cloning against code-comparison UIs.

**Novelty:** partial. Zoom insider impersonation [66] and Zoom ceremony spoofing [69] exist. DAVE documents the property [70]. New would be cross-system evidence and an end-to-end "CEO tile" demonstration.

**Risk:** reviewers may say "documented by design". The work needs disclosure etiquette. Novelty is thin without Candidate 1's fix.

**Feasibility:** very high. It reuses the author's attacker-in-the-middle tool.

**Venues:** the WOOT up-and-coming track, posters. **Recommended as the motivation section of Candidate 1.**

## Candidate 4: key-bound liveness ceremony ("physical SAS")

**Claim.** Derive a screen-illumination or corneal-reflection challenge from the call's key-exchange transcript, e.g., a pattern = PRF(SAS-key), shown on the verifier's screen. A relay-MITM (holding two different session keys) then has to *relight the victim's face in real time* to match the other side's key-derived pattern. This combines SAS [90, 91] with active-illumination liveness [19–22], extending Face Flashing's timing argument [21].

**Novelty:** no key-bound liveness challenge was found (targeted search). Existing illumination liveness uses random, unbound challenges.

**Risk:** the security argument is *heuristic*, dependent on deepfake capability; it needs computer-vision skill and user studies; it is fragile across lighting and devices.

**Venues:** poster/demo, ACM Student Research Competition, possibly a CVPR/ICASSP workshop. Lower crypto depth but high "wow factor".

## Candidate 5: Direction A as a characterization ("transcoding-tolerant authenticity at interactive latency is out of reach")

**Claim.** A quantitative map with measurements:

- ZK provers (Eva/VIMz-Loua/VerITAS) vs real-time throughput and latency;
- TEE-attested transcoding cost and trust assumptions;
- adversarial perturbation success against perceptual-hash or AMAC gates in a WebRTC pipeline [78–80];
- a formalized argument that public-verification, transform-tolerant schemes inherit an adversarial perturbation budget (cf. [81]).

Conclusion: calls should use forwarding plus layer-dropping-tolerant authentication [35, 60]. Only broadcast should attempt ZK/TEE.

**Novelty:** low–medium. It is mostly a synthesis, and the "impossibility" is soft because "semantic change" is not formal.

**Venues:** poster, SoK-lite workshop paper.

**Ranking rationale:**

| Rank | Candidate | Novelty | Feasibility | Crypto depth |
|---|---|---|---|---|
| 1 | Candidate 1 | medium | high | medium–high |
| 2 | Candidate 2 | medium–high | medium | high |
| 3 | Candidate 3 | low–medium | very high | low |
| 4 | Candidate 4 | uncertain–high | medium–low | low–medium |
| 5 | Candidate 5 | low | high | low |

Candidates 1 + 3 (+ 2 as an extension) form one coherent paper.

# 7. Honesty section

## 7.1 Gaps that are probably already closed (do not claim these)

- **E2E authenticity through a forwarding relay** (T2): frame E2EE [60, 70, 72], PERC [59]. Your MITM demos of tampering through a non-E2EE relay are *textbook*, not novel.
- **Live provenance for broadcast/streaming** (segment-level): C2PA 2.3 §19 [2]; surveillance signing [5]; codec-level signing [6].
- **Stream signature amortization and loss tolerance** [28–34]; **authentication surviving SVC layer extraction** [35]; **TESLA in RTP** [32].
- **Deniable two-party authentication** (OTR/DAKEZ/ZRTP-style symmetric keys) [37, 40, 91]. A *2-party* "deniable live call" is not new.
- **Forgeable-later and time-deniable signatures as primitives** [44–47]; **designated-verifier conversion** [49].
- **ZK proofs for edited images and lossy video** [83–88].
- **Challenge-response liveness for calls** [17–21].
- **Insider impersonation in Zoom** [66] and **ceremony spoofing** [69, 92].
- **Attacks on perceptual hashing** [78–80] and **watermark impossibility** [81].
- The **compactness/collusion-resistance tension** for multicast MACs [36] and the **pairwise necessity for deniable group authentication** [43]. Your trilemma must *build on* these explicitly, or it will be rejected as known.

## 7.2 What would falsify each novelty claim (searches to do before writing)

- **Candidate 1 is falsified if any of the following provide per-sender frame authentication for E2EE group media, especially with a deniability analysis:**
  - the full DAVE whitepaper (later versions);
  - the latest Zoom cryptography whitepaper (check whether frames are signed);
  - Signal's open-source calling code (whether frame keys are pairwise or shared, and whether frames are signed);
  - Cisco Webex E2EE (MLS-based; UNVERIFIED);
  - Apple FaceTime (Apple Platform Security guide);
  - WhatsApp's encryption whitepaper (group calls);
  - Google Meet client-side encryption;
  - IETF work on **MoQ (Media over QUIC) secure objects**, **MIMI** and **SFrame** errata/updates (not checked in this review).

  Also check whether the trilemma is stated in follow-ups to BDF [36], Schliep–Hopper [43], KeyForge [45] or time-deniable signatures [47], e.g., a lower bound for deniable broadcast authentication.
- **Candidate 2 is falsified by** any franking or abuse-reporting scheme for calls/streams (search: "franking" + "voice call"/"stream"/"RTP"/"SFrame"; WhatsApp/Messenger call reporting designs).
- **Candidate 3 is falsified by** existing cross-platform insider-impersonation studies after 2023; check the citations of [63–66, 69].
- **Candidate 4 is falsified by** any liveness or illumination challenge derived from session keys or SAS (search the face anti-spoofing/"injection attack" literature, iProov patents, LiveScreen's full text [22]).
- **Candidate 5 is falsified by** a real-time ZK or TEE live transcoding-provenance system. Check Eva follow-ups, VIMz-Loua, and Livepeer/Streamplace provenance.

## 7.3 What I could not verify (must be checked from primary sources)

- The full text of C2PA v2.3–2.5 §19 (host blocked). The session-key validity and rotation details come from vendor/SVTA docs [S2].
- Full text of RFC 9605 §7.2, draft-omara-sframe signature mode details, and the exact Isobe et al. attack mechanics (only abstracts and slide snippets seen) [60, 61, 63, 65].
- Zoom's frame-level signing [67]; Signal [71] and Orange Meets [72] per-sender frame authentication; Webex.
- Authors/venues: OTR DOI [37]; Bonneau et al. co-author/venue [38]; Prokos et al. co-authors [80]; LiveScreen [22]; Deepfake-Eval-2024 authors [16]; the virtual-camera paper [24]; the TechRxiv live C2PA/TPM preprint [14]; HyperVerITAS authors [86]; SOUPS 2017 authors [94]; the US patent assignee [12]; Di Crescenzo et al. venue [77] (Springer DOI suggests FC 2005); the FAccT venue for [78] (inferred from the ACM DOI).
- TESLA venue [30]: confirmed as the paper; the IEEE S&P 2000 venue is the standard citation but was not explicitly shown in the snippets.
- The H.274 edition containing DSC [6]; the Fluendo IBC 2026 talk content [7].
- RFC 3161 details [96] (secondary only).

## 7.4 Motivation risks (be upfront in the paper)

- **Victims want evidence.** Deepfake-fraud victims and enterprises want *non-repudiable* records, not deniability. Hence Candidate 2's "deniable by default, reportable to a designated party" framing, which matches the AMF philosophy [55].
- **Courts ignore deniability.** [52] found courts did not consider deniability for messaging. Argue instead from *leak/coercion* harms and data minimization, and say explicitly that deniability is a *policy option*.
- **Per-sender authentication helps T3, not T4.** A legitimately keyed participant can still stream synthetic video. Do not oversell. Pair it with identity binding and, optionally, liveness (Candidate 4) in the discussion.

# 8. Prioritized next steps (≈12–16 weeks with an advisor)

1. **Weeks 0–1. Advisor + falsification sweep.**
   - Read the primary texts: RFC 9605 (esp. §7.2), the DAVE whitepaper, Isobe et al. ESORICS 2021, Shiraki et al. JIP 2024, BDF 2001, Schliep–Hopper 2019, KeyForge, time-deniable and epochal signatures, TESLA and RFC 4383, Unger–Goldberg 2018, Collins et al. 2025, AMF/Hecate.
   - Run every falsification search in §7.2. If Candidate 1 is closed, pivot to Candidate 2 or 4.
2. **Weeks 1–3. Threat model.**
   - Parties: senders and receivers, the SFU, the MLS delivery/authentication service, a judge J, an optional moderator M.
   - Corruption: adaptive insiders; the relay as scheduler (delay/drop/reorder/inject).
   - Network and clock bounds; loss model; epochs; what is out of scope (T4 synthetic content by key holders).
3. **Weeks 3–5. Definitions.** Write games for per-sender unforgeability (PS-UF) with loss and scheduling, transcript consistency, and offline/online deniability (simulation-based, with and without a trusted-time oracle). See Appendix A.
4. **Weeks 4–8. Theory.**
   - Prove the trilemma: start with a restricted class (symmetric-key, o(n)-size authenticators) and lean on BDF-style arguments [36].
   - Prove constructions (a)–(c).
   - Optionally model the bootstrap in ProVerif/Tamarin.
5. **Weeks 5–10. Prototype.**
   - Extend the existing attacker-in-the-middle tool: Encoded Transform worker, SFrame-like layer, three authenticator modes, UI states (verified/pending/forged).
   - Insider-forgery demo against the baseline.
   - Check current browser support for `RTCRtpScriptTransform` and WebCrypto Ed25519 (not verified here).
6. **Weeks 10–12. Evaluation.** CPU and bytes per frame; verification delay; loss sweeps; SFU delay attack; n = 2…8; laptop + phone.
7. **Weeks 12–14. Write-up.** IACR ePrint preprint, then the next suitable workshop (WPES/WOOT/ACNS/FC workshop) or poster/SRC. Check current calls for papers: WOOT '26 and WPES 2026 deadlines have passed [S].
8. **Ethics.** Only own deployments and accounts. If a weakness in a third-party *product* is found, follow coordinated disclosure.

# 9. Honest verdict

Yes, there is a realistic, honest first contribution here for a supervised undergraduate. It is **not** the transcoding direction (A). That direction is either already solved (forwarding relays, layer-dropping, segment-level live provenance), architecturally irrelevant to E2EE calls, or blocked by adversarial and impossibility results and ~100× proving gaps. The live opportunity is a refined version of Direction B: **per-sender, insider-resistant authentication for E2EE group calls with a deliberate evidence policy.** The leading standard (RFC 9605) and a large deployment (Discord DAVE) explicitly leave this out, and the one attempt to add it was broken. Classic stream authentication (TESLA, RFC 4383), deniable messaging (OTR, KeyForge, epochal signatures) and franking (AMF, Hecate) give you the building blocks. Known results (BDF 2001, Schliep–Hopper 2019, KeyForge's timestamp caveat) tell you where the theorem is: compact, insider-resistant and judge-proof deniable cannot all hold. The novelty is the *formalization for lossy, relayed, real-time media plus constructions, a working browser prototype and an insider-forgery demo*, not a new primitive. The single best bet is Candidate 1, with Candidate 3 as its motivating attack and Candidate 2 as an optional "reportable" extension. The realistic best-case outcome is an ePrint preprint and acceptance at a workshop such as WPES or WOOT, or ACNS/an FC-co-located workshop. A strong poster or Student Research Competition entry is a solid fallback. CRYPTO/EUROCRYPT/CCS main track is not a realistic first target.

# Appendix A. Definition sketches (starting point, not final)

**Syntax.**

- A group epoch *e* has members P₁…Pₙ.
- Sender S emits frames (seq *j*, payload *mⱼ*). Each frame becomes an SFrame-like ciphertext *cⱼ* plus an authenticator *aⱼ*.
- Receivers output `accept(S, e, j, mⱼ)` or `reject`. Delivery is via a relay R.

**PS-UF (per-sender stream unforgeability).**

- Adversary A controls R: it can drop, delay, reorder, duplicate and inject.
- A adaptively corrupts any set C ∌ S of members, obtaining their full state, including group keys.
- A wins if some honest receiver outputs `accept(S, e, j, m)` where S never sent (e, j, m).
- Variant with freshness: A also wins if acceptance happens more than Δ after S sent the frame.
- Construction (b) needs an explicit clock-offset assumption; the relay's delays only cause rejection.

**Offline deniability (judge without trusted time).**

- There is a simulator Sim that, given a receiver R's state and the public keys, plus everything published after the call (e.g., disclosed chains or expired signing keys), outputs a transcript of authenticated frames for *arbitrary* chosen payloads.
- A judge J, given R's real view after time T, cannot distinguish it from Sim's output.

**Strong (time-robust) deniability.** The same, but J also receives trusted timestamps on R's view at receipt time. *Conjecture (trilemma):* any scheme satisfying PS-UF and strong deniability needs per-frame authenticator size Ω(n) in the symmetric setting. This is consistent with BDF [36] and Schliep–Hopper [43]. Pairwise vector-MACs meet it with equality. TESLA and expiring signatures satisfy only offline deniability.

**Transcript consistency (optional).** Honest receivers that accept (S, e, j, ·) accept the same payload. Signatures give this; pairwise MACs do not without an extra (deniable) cross-check.

# References

Labels: [A] arXiv abstract read; [S] confirmed via search quoting primary listings (full text not read); [S2] secondary sources only; [UNVERIFIED] with the unconfirmed detail named.

**Provenance and live provenance**

1. P. England, H. S. Malvar, E. Horvitz, et al. "AMP: Authentication of Media via Provenance." ACM MMSys '21, pp. 108–121. DOI 10.1145/3458305.3459599. arXiv 2001.07886. [S]
2. C2PA. "Content Credentials: C2PA Technical Specification," v2.3 (document dated 2026-01-05; §19 Live Video), v2.4, v2.5 ("live media"). spec.c2pa.org. [S; spec text not read: host blocked]
3. C2PA. "The C2PA Launches Content Credentials 2.3…," press release, 22 Jan 2026. c2pa.org. [S]
4. Google. "How Pixel and Android are bringing a new level of trust to your images with C2PA Content Credentials," Google Security Blog, Sept 2025 (Pixel 10, Assurance Level 2). [S; hardware details S2]
5. ONVIF. "Media Signing Specification," v26.06 (June 2026), add-on, release candidate; Axis Communications, "Signed Video" open-source framework. [S]
6. ITU-T H.274 (VSEI) "Digitally Signed Content" SEI messages (DSCI/DSCS/DSCV), developed in JVET; per Fluendo technical blog and GStreamer `gsth274` parser docs. [S2; edition UNVERIFIED]
7. Fluendo. "Open Source C2PA live-streaming ingestion with WebRTC using Digitally Signed Content," IBC 2026 session listing. [S2; content UNVERIFIED]
8. E. Golaszewski, N. Krawetz, A. T. Sherman, E. Zieglar, S. K. Matukumalli, R. Yus, C. L. Kegley, M. Barthel, W. Bowman, B. Barot, K. Kullman. "Verifying Provenance of Digital Media: Why the C2PA Specifications Fall Short." arXiv 2604.24890 (Apr 2026); also IACR ePrint 2026/804. Preprint/whitepaper. [A]
9. A. Nemecek, H. He, G. Cheng, E. Ayday. "Authenticated Contradictions from Desynchronized Provenance and Watermarking." CVPR 2026 Workshop APAI. arXiv 2603.02378. [A]
10. M. Awan, J. Collomosse. "Soft Redaction of Image Provenance via Zero-Knowledge Proofs." ECCV 2026 Workshop PFATCV (to appear). arXiv 2608.07063. [A]
11. World Privacy Forum. "Privacy, Identity and Trust in C2PA: A Technical Review and Analysis of the C2PA Digital Media Provenance Framework." [S2; date UNVERIFIED]
12. US Patent 12,244,875 B2. "Asserting and establishing provenance of media content during live streaming." [S2; assignee UNVERIFIED]
13. H. Schwartz, X. Yan, C. J. Carver, X. Zhou. "Combating Falsification of Speech Videos with Live Optical Signatures" (VeriLight). ACM CCS '25. arXiv 2504.21846. [A]
14. "Enabling Live Video Provenance and Authenticity: A C2PA-Based System with TPM-Based Security for Livestreaming Platforms." TechRxiv preprint. [UNVERIFIED: authors, date]

**Deepfake detection, liveness, incidents**

15. Y. Mirsky, W. Lee. "The Creation and Detection of Deepfakes: A Survey." ACM Computing Surveys 54(1), Art. 7, 2021. DOI 10.1145/3425780. [S]
16. "Deepfake-Eval-2024: A Multi-Modal In-the-Wild Benchmark of Deepfakes Circulated in 2024." arXiv 2503.02857 (Mar 2025). [S; authors UNVERIFIED here]
17. G. Mittal, C. Hegde, N. Memon. "GOTCHA: Real-Time Video Deepfake Detection via Challenge-Response." IEEE EuroS&P 2024. arXiv 2210.06186. [S]
18. G. Mittal, A. Jakobsson, K. O. Marshall, C. Hegde, N. Memon. "PITCH: AI-assisted Tagging of Deepfake Audio Calls using Challenge-Response." ASIA CCS 2025. arXiv 2402.18085. [A]
19. C. R. Gerstner, H. Farid. "Detecting Real-Time Deep-Fake Videos Using Active Illumination." CVPR Workshops 2022, pp. 53–60. DOI 10.1109/CVPRW56347.2022.00015. [S]
20. H. Guo, X. Wang, S. Lyu. "Detection of Real-time DeepFakes in Video Conferencing with Active Probing and Corneal Reflection." arXiv 2210.14153 (2022). [A]
21. D. Tang, Z. Zhou, Y. Zhang, K. Zhang. "Face Flashing: a Secure Liveness Detection Protocol based on Light Reflections." NDSS 2018. arXiv 1801.01949. [S]
22. "LiveScreen: Video Chat Liveness Detection Leveraging Skin Reflection." Rutgers WINLAB. [UNVERIFIED: authors, venue]
23. P. F. Michael, Z. Hao, S. Belongie, A. Davis. "Noise-Coded Illumination for Forensic and Photometric Video Analysis." ACM TOG 44(5), Art. 165, 2025. DOI 10.1145/3742892. arXiv 2507.23002. [S]
24. "Virtual camera detection: Catching video injection attacks in remote biometric systems." arXiv 2512.10653. [S; authors UNVERIFIED]
25. FBI IC3. "Deepfakes and Stolen PII Utilized to Apply for Remote Work Positions," PSA I-062822-PSA, 28 June 2022. ic3.gov. [S]
26. Arup deepfake video-conference fraud (Hong Kong, 2024): CFO Dive and other press reports. [S2]
27. Recapture/analog-hole demonstrations and commentary on C2PA limits (e.g., signed-then-edited lottery-ticket demo; "Scoop2" depth-sensing countermeasure on NSF PAR). [S2; authors/venues UNVERIFIED]

**Stream and broadcast authentication**

28. R. Gennaro, P. Rohatgi. "How to Sign Digital Streams." CRYPTO '97; full version Information and Computation 165:100–116, 2001. [S]
29. C. K. Wong, S. S. Lam. "Digital Signatures for Flows and Multicasts." IEEE/ACM Transactions on Networking, 1999. [S]
30. A. Perrig, R. Canetti, J. D. Tygar, D. Song. "Efficient Authentication and Signing of Multicast Streams over Lossy Channels" (TESLA, EMSS). IEEE S&P 2000. [S; venue per standard citation]
31. A. Perrig, R. Canetti, D. Song, J. D. Tygar, B. Briscoe. RFC 4082, "TESLA: Multicast Source Authentication Transform Introduction," 2005. [S; year not shown in snippets, re-check]
32. M. Baugher, E. Carrara. RFC 4383, "The Use of TESLA in the Secure Real-time Transport Protocol (SRTP)," Feb 2006. [S]
33. P. Golle, N. Modadugu. "Authenticating Streamed Data in the Presence of Random Packet Loss." NDSS 2001, pp. 13–22. [S]
34. Y. Challal, H. Bettahar, A. Bouabdallah. "A Taxonomy of Multicast Data Origin Authentication: Issues and Solutions." IEEE Communications Surveys & Tutorials 6:34–57, 2004. DOI 10.1109/COMST.2004.5342292. [S]
35. K. Mokhtarian, M. Hefeeda. "Authentication of Scalable Video Streams With Low Communication Overhead." IEEE Transactions on Multimedia 12(7):730–742, 2010. DOI 10.1109/TMM.2010.2051410. [S]
36. D. Boneh, G. Durfee, M. Franklin. "Lower Bounds for Multicast Message Authentication." EUROCRYPT 2001, LNCS 2045, pp. 437–452. DOI 10.1007/3-540-44987-6_27. [S]

**Deniability, designated verification, franking**

37. N. Borisov, I. Goldberg, E. Brewer. "Off-the-Record Communication, or, Why Not To Use PGP." ACM WPES 2004, pp. 77–84. [S; DOI UNVERIFIED]
38. J. Bonneau et al. "Finite-State Security Analysis of OTR Version 2." 2006. [S; co-author and venue UNVERIFIED]
39. N. Unger, I. Goldberg. "Deniable Key Exchanges for Secure Messaging." ACM CCS 2015. [S]
40. N. Unger, I. Goldberg. "Improved Strongly Deniable Authenticated Key Exchanges for Secure Messaging." PoPETs 2018(1). DOI 10.1515/popets-2018-0003. [S]
41. N. Vatandas, R. Gennaro, B. Ithurburn, H. Krawczyk. "On the Cryptographic Deniability of the Signal Protocol." ACNS 2020, pp. 188–209. ePrint 2021/642. [S]
42. I. Goldberg, B. Ustaoğlu, M. Van Gundy, H. Chen. "Multi-party Off-the-Record Messaging." ACM CCS 2009. [S]
43. M. Schliep, N. Hopper. "End-to-End Secure Mobile Group Messaging with Conversation Integrity and Deniability." ACM WPES 2019. DOI 10.1145/3338498.3358644. ePrint 2018/1097. [S]
44. A. Hülsing, F. J. Weber. "Epochal Signatures for Deniable Group Chats." IEEE S&P 2021, pp. 1677–1695. DOI 10.1109/SP40001.2021.00058. ePrint 2020/1138. [S]
45. M. A. Specter, S. Park, M. Green. "KeyForge: Non-Attributable Email from Forward-Forgeable Signatures." USENIX Security 2021, pp. 1755–1773. arXiv 1904.06425; ePrint 2019/390. [S]
46. A. Arun, J. Bonneau, J. Clark. "Short-lived Zero-Knowledge Proofs and Signatures." ASIACRYPT 2022, LNCS 13793, pp. 487–516. ePrint 2022/190. [S]
47. G. Beck, A. R. Choudhuri, M. Green, A. Jain, P. R. Tiwari. "Time-Deniable Signatures." PoPETs 2023(3):79–102. DOI 10.56553/popets-2023-0071. ePrint 2022/1018. [S]
48. M. Jakobsson, K. Sako, R. Impagliazzo. "Designated Verifier Proofs and Their Applications." EUROCRYPT '96, LNCS 1070, pp. 143–154. DOI 10.1007/3-540-68339-9_13. [S]
49. R. Steinfeld, L. Bull, H. Wang, J. Pieprzyk. "Universal Designated-Verifier Signatures." ASIACRYPT 2003, LNCS 2894, pp. 523–542. ePrint 2003/193. [S]
50. H. Krawczyk, T. Rabin. "Chameleon Signatures." NDSS 2000. [S]
51. R. Rivest, A. Shamir, Y. Tauman. "How to Leak a Secret." ASIACRYPT 2001, LNCS 2248, pp. 552–565. DOI 10.1007/3-540-45682-1_32. [S]
52. D. Collins, S. Colombo, L. Huguenin-Dumittan. "Real-World Deniability in Messaging." PoPETs 2025(1):320–340. ePrint 2023/403. [S]
53. RFC 9750. "The Messaging Layer Security (MLS) Architecture," April 2025; §8.2.3 "Non-Repudiation vs. Deniability." [S]
54. Y. Dodis, P. Grubbs, T. Ristenpart, J. Woodage. "Fast Message Franking: From Invisible Salamanders to Encryptment." CRYPTO 2018. ePrint 2019/016. [S]
55. N. Tyagi, P. Grubbs, J. Len, I. Miers, T. Ristenpart. "Asymmetric Message Franking: Content Moderation for Metadata-Private End-to-End Encryption." CRYPTO 2019, LNCS 11694, pp. 222–250. ePrint 2019/565. [S]
56. R. Issa, N. Alhaddad, M. Varia. "Hecate: Abuse Reporting in Secure Messengers with Sealed Sender." USENIX Security 2022. ePrint 2021/1686. [S]
57. "SoK: Content Moderation Schemes in End-to-End Encrypted Systems." arXiv 2208.11147. [S; authors UNVERIFIED here]

**E2EE real-time media**

58. E. Rescorla. RFC 8827, "WebRTC Security Architecture," Jan 2021; W3C "Identity for WebRTC 1.0" split; Mozilla bug 1258400. [S; deployment status UNVERIFIED]
59. P. Jones, D. Benham, C. Groves. RFC 8871, "A Solution Framework for Private Media in Privacy-Enhanced RTP Conferencing (PERC)," Jan 2021. [S]
60. RFC 9605. "Secure Frame (SFrame): Lightweight Authenticated Encryption for Real-Time Media," Aug 2024; §7.2 "No Per-Sender Authentication"; IETF dispatch list discussion (2020). [S; full §7.2 text to re-read]
61. E. Omara et al. draft-omara-sframe-01 (Nov 2020), -03 (Aug 2021): signature-over-tags mode. [S]
62. R. Barnes, R. Robert. draft-barnes-sframe-mls-00: MLS-derived per-sender keys do not authenticate senders. [S]
63. T. Isobe, R. Ito, K. Minematsu. "Security Analysis of SFrame." ESORICS 2021, LNCS 12973, pp. 127–146. ePrint 2021/424. [S]
64. T. Isobe, R. Ito, K. Minematsu. "Cryptanalysis on End-to-End Encryption Schemes of Communication Tools and Its Research Trend." Journal of Information Processing 31:523–536, 2023. DOI 10.2197/ipsjjip.31.523. [S]
65. S. Shiraki, H. Kimura, T. Isobe. "Looking Further into the Security of End-to-End Encryption of SFrame." Journal of Information Processing 32:679–689, 2024. [S]
66. T. Isobe, R. Ito. "Security Analysis of End-to-End Encryption for Zoom Meetings." ACISP 2021 / IEEE Access. ePrint 2021/486. [S]
67. J. Blum, O. Gal, M. Krohn, J. Len, et al. "Zoom Cryptography Whitepaper" (E2EE design), 2020–. [S; frame-signing details UNVERIFIED]
68. Y. Dodis, D. Jost, B. Kesavan, A. Marcedone. "End-to-End Encrypted Zoom Meetings: Proving Security and Strengthening Liveness." EUROCRYPT 2023, LNCS 14008, pp. 157–189. ePrint 2023/1829. [S]
69. M. Alatawi, N. Saxena. "VOICE-ZEUS: Impersonating Zoom's E2EE-Protected Static Media and Textual Communications via Simple Voice Manipulations." arXiv 2310.13894 (2023). [A]
70. Discord. "DAVE Protocol Whitepaper" (v1.1), daveprotocol.com; github.com/discord/dave-protocol; Discord blog "Meet DAVE" (2024); Trail of Bits audit. [S]
71. Signal. "How to build large-scale end-to-end encrypted group video calls," blog, Dec 2021. [S; key distribution UNVERIFIED]
72. Cloudflare. "Orange Me2eets: We made an end-to-end encrypted video calling app and it was easy," blog, 26 June 2025. [S]
73. W3C. "WebRTC Encoded Transform," Working Draft (Dec 2025). [S]
74. R. Barnes, B. Beurdouche, R. Robert, J. Millican, E. Omara, K. Cohn-Gordon. RFC 9420, "The Messaging Layer Security (MLS) Protocol," July 2023. [S]

**Robust hashing, approximate authentication, transformation proofs**

75. C.-Y. Lin, S.-F. Chang. "A Robust Image Authentication Method Distinguishing JPEG Compression from Malicious Manipulation." IEEE TCSVT 11(2):153–168, 2001. DOI 10.1109/76.905982. [S]
76. L. Xie, G. R. Arce, R. F. Graveman. "Approximate Image Message Authentication Codes." IEEE Transactions on Multimedia, 2001; R. Graveman, K. Fu, "Approximate message authentication codes" (1999). [S; 1999 venue UNVERIFIED]
77. G. Di Crescenzo, R. Graveman, R. Ge, G. Arce. "Approximate Message Authentication and Biometric Entity Authentication." 2005, Springer DOI 10.1007/11507840_22. [S; venue (likely FC 2005) UNVERIFIED]
78. L. Struppek, D. Hintersdorf, D. Neider, K. Kersting. "Learning to Break Deep Perceptual Hashing: The Use Case NeuralHash." ACM FAccT 2022 (DOI 10.1145/3531146.3533073). arXiv 2111.06628. [S; venue inferred from DOI]
79. S. Jain, A.-M. Crețu, Y.-A. de Montjoye. "Adversarial Detection Avoidance Attacks: Evaluating the Robustness of Perceptual Hashing-Based Client-Side Scanning." USENIX Security 2022, pp. 2317–2334. [S]
80. J. Prokos et al. "Squint Hard Enough: Attacking Perceptual Hashing with Adversarial Machine Learning." USENIX Security 2023, pp. 211–228. [S; co-author list UNVERIFIED]
81. H. Zhang, B. Edelman, D. Francati, D. Venturi, G. Ateniese, B. Barak. "Watermarks in the Sand: Impossibility of Strong Watermarking for Generative Models." ICML 2024. arXiv 2311.04378. [S]
82. P. Fernandez, H. Elsahar, I. Z. Yalniz, A. Mourachko. "Video Seal: Open and Efficient Video Watermarking." arXiv 2412.09492 (2024). [S]
83. A. Naveh, E. Tromer. "PhotoProof: Cryptographic Image Authentication for Any Set of Permissible Transformations." IEEE S&P 2016, pp. 255–271. [S]
84. D. Kang, T. Hashimoto, I. Stoica, Y. Sun. "ZK-IMG: Attested Images via Zero-Knowledge Proofs to Fight Disinformation." arXiv 2211.04775 (2022). [A]
85. T. Datta, B. Chen, D. Boneh. "VerITAS: Verifying Image Transformations at Scale." IEEE S&P 2025. ePrint 2024/1066. [S]
86. "HyperVerITAS: Verifying Image Transformations at Scale on Boolean Hypercubes." PoPETs 2026. [S; authors UNVERIFIED here]
87. S. Dziembowski, S. Ebrahimi, P. Hassanizadeh. "VIMz: Private Proofs of Image Manipulation using Folding-based zkSNARKs." PoPETs 2025(2):344–362. ePrint 2024/1063. [S]
88. C. Zhang, X. Yang, D. Oswald, M. Ryan, P. Jovanovic. "Eva: Efficient Privacy-Preserving Proof of Authenticity for Lossily Encoded Videos." IEEE S&P 2025, pp. 4643–4662. ePrint 2024/1436. [S]
89. Andujar et al. "Video Tampering Detection for Decentralized Video Transcoding Networks." ICIAR 2020. DOI 10.1007/978-3-030-50347-5_28; Livepeer verification forum/whitepaper. [S; full author list UNVERIFIED]

**SAS and human verification**

90. S. Vaudenay. "Secure Communications over Insecure Channels Based on Short Authenticated Strings." CRYPTO 2005, LNCS 3621, pp. 309–326. [S]
91. P. Zimmermann, A. Johnston (ed.), J. Callas. RFC 6189, "ZRTP: Media Path Key Agreement for Unicast Secure RTP," April 2011. [S]
92. M. Shirvanian, N. Saxena. "Wiretapping via Mimicry: Short Voice Imitation Man-in-the-Middle Attacks on Crypto Phones." ACM CCS 2014, pp. 868–879; extended in Journal of Computer Security 26(3):311–333, 2018. [S]
93. J. Tan, L. Bauer, J. Bonneau, L. F. Cranor, J. Thomas, B. Ur. "Can Unicorns Help Users Compare Crypto Key Fingerprints?" ACM CHI 2017. DOI 10.1145/3025453.3025733. [S]
94. Vaziripour et al. "Is that you, Alice? A Usability Study of the Authentication Ceremony of Secure Messaging Applications." SOUPS 2017, pp. 29–47. [S; author list UNVERIFIED]

**Time and latency**

95. S. Haber, W. S. Stornetta. "How to Time-Stamp a Digital Document." Journal of Cryptology 3(2):99–111, 1991. [S]
96. RFC 3161. "Internet X.509 PKI Time-Stamp Protocol (TSP)." [S2]
97. ITU-T Recommendation G.114 (05/2003), "One-way transmission time." [S]
