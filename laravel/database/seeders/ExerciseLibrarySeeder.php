<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\ExerciseCategory;
use App\Enums\ExerciseMetric;
use App\Models\Exercise;
use Illuminate\Database\Seeder;

/**
 * The built-in exercise catalog.
 *
 * These rows have no owner (`user_id` null): everybody can read them and
 * nobody can edit them. A user who wants a variation creates their own
 * exercise instead, which is theirs alone.
 *
 * The instructions and cues are written for this project. There are no images
 * and no video, and the issue's "form demonstrations" are met in text for the
 * same reason the Pomodoro sounds are synthesised rather than sampled:
 * bundling demo media would mean redistributing somebody else's work.
 *
 * Re-seeding updates rather than duplicates - the key is the slug, since the
 * unique index on (user_id, slug) does not constrain rows whose user_id is
 * null (two NULLs are distinct in SQLite and MySQL alike).
 */
class ExerciseLibrarySeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->catalog() as $exercise) {
            Exercise::query()->updateOrCreate(
                ['user_id' => null, 'slug' => $exercise['slug']],
                $exercise
            );
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function catalog(): array
    {
        return [
            // ── Strength: lower body ──────────────────────────────────────
            [
                'slug' => 'back-squat',
                'name' => 'Back squat',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::WeightReps,
                'primary_muscle' => 'Quadriceps',
                'equipment' => 'Barbell',
                'instructions' => 'Rest the bar across your upper back, not your neck. Stand with feet about shoulder width, toes turned slightly out. Break at the hips and knees together and sit down between your feet until your thighs are at least parallel to the floor, then drive back up through the whole foot.',
                'cues' => ['Brace your middle before you move', 'Knees track over your toes', 'Chest stays up out of the hole', 'Push the floor away'],
            ],
            [
                'slug' => 'front-squat',
                'name' => 'Front squat',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::WeightReps,
                'primary_muscle' => 'Quadriceps',
                'equipment' => 'Barbell',
                'instructions' => 'Hold the bar across the front of your shoulders with elbows high. Squat straight down, keeping your torso as upright as you can, and stand back up without letting the elbows drop.',
                'cues' => ['Elbows up throughout', 'Stay tall', 'Weight through mid-foot'],
            ],
            [
                'slug' => 'goblet-squat',
                'name' => 'Goblet squat',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::WeightReps,
                'primary_muscle' => 'Quadriceps',
                'equipment' => 'Dumbbell',
                'instructions' => 'Hold one weight against your chest. Squat down between your feet, letting your elbows pass inside your knees, then stand.',
                'cues' => ['Weight tight to the chest', 'Sit down, not back', 'Full depth before standing'],
            ],
            [
                'slug' => 'conventional-deadlift',
                'name' => 'Deadlift',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::WeightReps,
                'primary_muscle' => 'Posterior chain',
                'equipment' => 'Barbell',
                'instructions' => 'Stand with the bar over your mid-foot. Hinge down and take a grip just outside your knees. Take the slack out of the bar, set your back flat, then stand up by pushing the floor away and bringing your hips forward. Lower it under control along the same path.',
                'cues' => ['Bar stays against your legs', 'Back flat, never rounding', 'Hips and shoulders rise together', 'Finish standing tall, no lean back'],
            ],
            [
                'slug' => 'romanian-deadlift',
                'name' => 'Romanian deadlift',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::WeightReps,
                'primary_muscle' => 'Hamstrings',
                'equipment' => 'Barbell',
                'instructions' => 'Start standing with the bar at your hips. Push your hips back and let the bar travel down your thighs with only a slight knee bend, until you feel your hamstrings load. Stand back up by driving the hips forward.',
                'cues' => ['Hips back, not knees forward', 'Stop where your back would round', 'Bar stays close'],
            ],
            [
                'slug' => 'bulgarian-split-squat',
                'name' => 'Bulgarian split squat',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::WeightReps,
                'primary_muscle' => 'Quadriceps',
                'equipment' => 'Dumbbell',
                'instructions' => 'Rest the top of your back foot on a bench behind you. Lower straight down until your front thigh is parallel to the floor, then drive up through the front leg. Repeat on the other side.',
                'cues' => ['Front shin close to vertical', 'Back knee drops down, not forward', 'Even reps on both legs'],
            ],
            [
                'slug' => 'walking-lunge',
                'name' => 'Walking lunge',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::WeightReps,
                'primary_muscle' => 'Glutes',
                'equipment' => 'Dumbbell',
                'instructions' => 'Step forward and lower until both knees are bent about ninety degrees, then drive through the front foot and step straight into the next lunge.',
                'cues' => ['Torso upright', 'Long enough step that the front knee stays over the foot', 'Count each leg separately'],
            ],
            [
                'slug' => 'hip-thrust',
                'name' => 'Hip thrust',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::WeightReps,
                'primary_muscle' => 'Glutes',
                'equipment' => 'Barbell',
                'instructions' => 'Sit with your upper back on a bench and the bar across your hips. Drive your hips up until your body makes a straight line from knees to shoulders, pause, then lower.',
                'cues' => ['Chin tucked, ribs down', 'Squeeze at the top', 'Shins vertical at lockout'],
            ],
            [
                'slug' => 'calf-raise',
                'name' => 'Calf raise',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::WeightReps,
                'primary_muscle' => 'Calves',
                'equipment' => 'Bodyweight',
                'instructions' => 'Stand with the balls of your feet on an edge. Drop your heels until you feel a stretch, then press up as high as you can and pause.',
                'cues' => ['Full range both ways', 'Pause at the top', 'No bouncing'],
            ],

            // ── Strength: upper body, push ────────────────────────────────
            [
                'slug' => 'bench-press',
                'name' => 'Bench press',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::WeightReps,
                'primary_muscle' => 'Chest',
                'equipment' => 'Barbell',
                'instructions' => 'Lie back with your eyes under the bar and feet planted. Take a grip a little wider than your shoulders, unrack, and lower the bar to your lower chest under control. Press it back up and slightly towards your face.',
                'cues' => ['Shoulder blades pulled back and down', 'Elbows tucked to about 45 degrees', 'Touch the chest, no bounce', 'Feet stay down'],
            ],
            [
                'slug' => 'incline-bench-press',
                'name' => 'Incline bench press',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::WeightReps,
                'primary_muscle' => 'Upper chest',
                'equipment' => 'Barbell',
                'instructions' => 'Set the bench to around thirty degrees and press as you would on a flat bench, lowering to the upper chest.',
                'cues' => ['Keep the shoulders set', 'Bar path slightly back', 'Control the descent'],
            ],
            [
                'slug' => 'overhead-press',
                'name' => 'Overhead press',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::WeightReps,
                'primary_muscle' => 'Shoulders',
                'equipment' => 'Barbell',
                'instructions' => 'Stand with the bar at your collarbones, grip just outside your shoulders. Move your head back slightly and press the bar straight up until your arms are locked out with the bar over the middle of your feet.',
                'cues' => ['Brace hard, no leaning back', 'Head moves back then through', 'Finish with the bar over your ears'],
            ],
            [
                'slug' => 'dumbbell-shoulder-press',
                'name' => 'Dumbbell shoulder press',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::WeightReps,
                'primary_muscle' => 'Shoulders',
                'equipment' => 'Dumbbell',
                'instructions' => 'Start with the weights at shoulder height, palms facing forward. Press up until your arms lock, then lower under control.',
                'cues' => ['Ribs down', 'Wrists stacked over elbows', 'No arching the lower back'],
            ],
            [
                'slug' => 'push-up',
                'name' => 'Push-up',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::RepsOnly,
                'primary_muscle' => 'Chest',
                'equipment' => 'Bodyweight',
                'instructions' => 'Set your hands a little wider than your shoulders. Keeping a straight line from heels to head, lower your chest to just above the floor and press back up.',
                'cues' => ['Body moves as one piece', 'Elbows back at 45 degrees, not flared', 'Full lockout at the top'],
            ],
            [
                'slug' => 'dip',
                'name' => 'Dip',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::RepsOnly,
                'primary_muscle' => 'Triceps',
                'equipment' => 'Parallel bars',
                'instructions' => 'Support yourself on the bars with your arms locked. Lower until your upper arms are roughly parallel to the floor, then press back up.',
                'cues' => ['Lean forward slightly for chest, stay upright for triceps', 'Shoulders stay down', 'Stop before shoulder discomfort'],
            ],
            [
                'slug' => 'triceps-pushdown',
                'name' => 'Triceps pushdown',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::WeightReps,
                'primary_muscle' => 'Triceps',
                'equipment' => 'Cable',
                'instructions' => 'Stand facing a high pulley. Keeping your elbows pinned to your sides, straighten your arms fully, then let them return under control.',
                'cues' => ['Elbows do not travel', 'Full lockout, then full stretch', 'No body English'],
            ],
            [
                'slug' => 'lateral-raise',
                'name' => 'Lateral raise',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::WeightReps,
                'primary_muscle' => 'Side deltoids',
                'equipment' => 'Dumbbell',
                'instructions' => 'Stand with light weights at your sides. Raise them out to shoulder height with a slight bend in the elbow, then lower slowly.',
                'cues' => ['Lead with the elbows', 'Stop at shoulder height', 'Lighter than you think'],
            ],

            // ── Strength: upper body, pull ────────────────────────────────
            [
                'slug' => 'pull-up',
                'name' => 'Pull-up',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::RepsOnly,
                'primary_muscle' => 'Lats',
                'equipment' => 'Pull-up bar',
                'instructions' => 'Hang from the bar with an overhand grip. Pull your chest towards the bar until your chin clears it, then lower all the way down.',
                'cues' => ['Start from a dead hang', 'Pull your elbows down to your ribs', 'Chest to the bar', 'No kicking'],
            ],
            [
                'slug' => 'chin-up',
                'name' => 'Chin-up',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::RepsOnly,
                'primary_muscle' => 'Lats',
                'equipment' => 'Pull-up bar',
                'instructions' => 'As a pull-up, but with your palms facing you and hands about shoulder width. The underhand grip brings the biceps in more.',
                'cues' => ['Dead hang to chin over the bar', 'Shoulders away from your ears', 'Control the way down'],
            ],
            [
                'slug' => 'barbell-row',
                'name' => 'Barbell row',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::WeightReps,
                'primary_muscle' => 'Upper back',
                'equipment' => 'Barbell',
                'instructions' => 'Hinge forward until your torso is around forty-five degrees, back flat. Pull the bar to your lower ribs, then lower it under control without letting your torso rise.',
                'cues' => ['Torso angle stays fixed', 'Pull to the bottom of the ribs', 'Squeeze the shoulder blades', 'No jerking with the hips'],
            ],
            [
                'slug' => 'dumbbell-row',
                'name' => 'Dumbbell row',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::WeightReps,
                'primary_muscle' => 'Upper back',
                'equipment' => 'Dumbbell',
                'instructions' => 'Brace one hand on a bench, hinge over, and row the weight to your hip. Lower it to a full stretch each rep.',
                'cues' => ['Back flat, hips square', 'Elbow travels back, not out', 'Full stretch at the bottom'],
            ],
            [
                'slug' => 'lat-pulldown',
                'name' => 'Lat pulldown',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::WeightReps,
                'primary_muscle' => 'Lats',
                'equipment' => 'Cable',
                'instructions' => 'Sit with your thighs secured and take a wide overhand grip. Pull the bar to your upper chest, then let it rise under control to a full stretch.',
                'cues' => ['Chest up, slight lean back', 'Elbows down towards the floor', 'No leaning back to finish the rep'],
            ],
            [
                'slug' => 'face-pull',
                'name' => 'Face pull',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::WeightReps,
                'primary_muscle' => 'Rear deltoids',
                'equipment' => 'Cable',
                'instructions' => 'Set a rope at head height. Pull it towards your face, separating your hands and finishing with your knuckles beside your ears.',
                'cues' => ['Elbows high', 'Pull apart as well as back', 'Light weight, slow tempo'],
            ],
            [
                'slug' => 'biceps-curl',
                'name' => 'Biceps curl',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::WeightReps,
                'primary_muscle' => 'Biceps',
                'equipment' => 'Dumbbell',
                'instructions' => 'Stand with the weights at your sides, palms forward. Curl up without letting your elbows drift forward, then lower all the way.',
                'cues' => ['Elbows pinned to your sides', 'No swinging', 'Full extension at the bottom'],
            ],

            // ── Strength: core ────────────────────────────────────────────
            [
                'slug' => 'plank',
                'name' => 'Plank',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::Duration,
                'primary_muscle' => 'Core',
                'equipment' => 'Bodyweight',
                'instructions' => 'Rest on your forearms and toes with your body in a straight line. Hold, breathing normally, until form breaks.',
                'cues' => ['Squeeze glutes and brace', 'Hips level with shoulders, not sagging or piked', 'Keep breathing'],
            ],
            [
                'slug' => 'hanging-leg-raise',
                'name' => 'Hanging leg raise',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::RepsOnly,
                'primary_muscle' => 'Core',
                'equipment' => 'Pull-up bar',
                'instructions' => 'Hang from a bar and raise your legs until they are at least parallel to the floor, then lower them under control without swinging.',
                'cues' => ['Curl the pelvis up, do not just lift the legs', 'No swinging between reps', 'Slow on the way down'],
            ],
            [
                'slug' => 'dead-bug',
                'name' => 'Dead bug',
                'category' => ExerciseCategory::Strength,
                'metric' => ExerciseMetric::RepsOnly,
                'primary_muscle' => 'Core',
                'equipment' => 'Bodyweight',
                'instructions' => 'Lie on your back with knees and arms up. Lower one arm and the opposite leg towards the floor while keeping your lower back flat, then return and swap.',
                'cues' => ['Lower back stays pressed down', 'Move slowly', 'Exhale as you extend'],
            ],

            // ── Cardio ───────────────────────────────────────────────────
            [
                'slug' => 'running',
                'name' => 'Running',
                'category' => ExerciseCategory::Cardio,
                'metric' => ExerciseMetric::DistanceDuration,
                'primary_muscle' => 'Full body',
                'equipment' => 'None',
                'instructions' => 'Run at a pace you can sustain for the distance you planned. Log the distance covered and the time it took.',
                'cues' => ['Relaxed shoulders', 'Land under your hips, not out in front', 'Hold the pace you can finish on'],
            ],
            [
                'slug' => 'treadmill-walk',
                'name' => 'Treadmill walk',
                'category' => ExerciseCategory::Cardio,
                'metric' => ExerciseMetric::DistanceDuration,
                'primary_muscle' => 'Full body',
                'equipment' => 'Treadmill',
                'instructions' => 'Walk at a steady pace, optionally on an incline. Log distance and time.',
                'cues' => ['Upright posture', 'Let the arms swing', 'Do not hold the rails'],
            ],
            [
                'slug' => 'cycling',
                'name' => 'Cycling',
                'category' => ExerciseCategory::Cardio,
                'metric' => ExerciseMetric::DistanceDuration,
                'primary_muscle' => 'Quadriceps',
                'equipment' => 'Bicycle',
                'instructions' => 'Ride at a steady effort or in intervals. Log the distance and the time.',
                'cues' => ['Smooth pedal stroke', 'Keep the cadence up rather than grinding a big gear'],
            ],
            [
                'slug' => 'rowing',
                'name' => 'Rowing',
                'category' => ExerciseCategory::Cardio,
                'metric' => ExerciseMetric::DistanceDuration,
                'primary_muscle' => 'Full body',
                'equipment' => 'Rowing machine',
                'instructions' => 'Drive with the legs first, then swing the torso back, then pull the handle to your ribs. Reverse that order on the recovery.',
                'cues' => ['Legs, body, arms - then arms, body, legs', 'Keep the chain level', 'Do not rush the recovery'],
            ],
            [
                'slug' => 'skipping',
                'name' => 'Skipping',
                'category' => ExerciseCategory::Cardio,
                'metric' => ExerciseMetric::Duration,
                'primary_muscle' => 'Calves',
                'equipment' => 'Jump rope',
                'instructions' => 'Skip at a steady rhythm for the time you planned, turning the rope from the wrists.',
                'cues' => ['Small jumps', 'Turn from the wrists, not the arms', 'Stay on the balls of your feet'],
            ],
            [
                'slug' => 'burpee',
                'name' => 'Burpee',
                'category' => ExerciseCategory::Cardio,
                'metric' => ExerciseMetric::RepsOnly,
                'primary_muscle' => 'Full body',
                'equipment' => 'Bodyweight',
                'instructions' => 'From standing, drop to a push-up position, lower your chest to the floor, push back up, jump your feet in, and jump up.',
                'cues' => ['Chest actually touches', 'Land soft', 'Pace it - these punish going out hard'],
            ],
            [
                'slug' => 'stair-climb',
                'name' => 'Stair climb',
                'category' => ExerciseCategory::Cardio,
                'metric' => ExerciseMetric::Duration,
                'primary_muscle' => 'Glutes',
                'equipment' => 'Stairs',
                'instructions' => 'Climb at a steady pace for the planned time, stepping fully onto each stair.',
                'cues' => ['Whole foot on the step', 'Stand tall', 'Drive through the hips'],
            ],

            // ── Flexibility ──────────────────────────────────────────────
            [
                'slug' => 'hamstring-stretch',
                'name' => 'Hamstring stretch',
                'category' => ExerciseCategory::Flexibility,
                'metric' => ExerciseMetric::Duration,
                'primary_muscle' => 'Hamstrings',
                'equipment' => 'None',
                'instructions' => 'Sit with one leg straight and hinge forward from the hips until you feel a stretch behind the thigh. Hold, then swap sides.',
                'cues' => ['Hinge at the hips, do not round the back', 'Stretch, never pain', 'Breathe out into it'],
            ],
            [
                'slug' => 'hip-flexor-stretch',
                'name' => 'Hip flexor stretch',
                'category' => ExerciseCategory::Flexibility,
                'metric' => ExerciseMetric::Duration,
                'primary_muscle' => 'Hip flexors',
                'equipment' => 'None',
                'instructions' => 'Kneel on one knee with the other foot forward. Tuck your pelvis under and push your hips gently forward until you feel the front of the hip open. Hold, then swap.',
                'cues' => ['Tuck the pelvis first', 'Squeeze the glute on the kneeling side', 'Stay upright'],
            ],
            [
                'slug' => 'chest-doorway-stretch',
                'name' => 'Chest stretch',
                'category' => ExerciseCategory::Flexibility,
                'metric' => ExerciseMetric::Duration,
                'primary_muscle' => 'Chest',
                'equipment' => 'None',
                'instructions' => 'Place a forearm against a doorframe with the elbow at shoulder height and turn your body away until you feel the chest open. Hold, then swap.',
                'cues' => ['Elbow at shoulder height', 'Rotate the body, do not push the arm', 'Shoulder stays down'],
            ],
            [
                'slug' => 'calf-stretch',
                'name' => 'Calf stretch',
                'category' => ExerciseCategory::Flexibility,
                'metric' => ExerciseMetric::Duration,
                'primary_muscle' => 'Calves',
                'equipment' => 'None',
                'instructions' => 'Stand facing a wall with one foot back, heel down and leg straight. Lean in until you feel the calf stretch. Hold, then swap.',
                'cues' => ['Back heel stays down', 'Back knee straight', 'Toes pointing forward'],
            ],

            // ── Mobility ─────────────────────────────────────────────────
            [
                'slug' => 'cat-cow',
                'name' => 'Cat-cow',
                'category' => ExerciseCategory::Mobility,
                'metric' => ExerciseMetric::RepsOnly,
                'primary_muscle' => 'Spine',
                'equipment' => 'None',
                'instructions' => 'On hands and knees, alternate between arching your back towards the ceiling and letting it sag while lifting your chest. Move with your breath.',
                'cues' => ['Move one segment at a time', 'Exhale rounding, inhale arching', 'No forcing the end range'],
            ],
            [
                'slug' => 'worlds-greatest-stretch',
                'name' => "World's greatest stretch",
                'category' => ExerciseCategory::Mobility,
                'metric' => ExerciseMetric::RepsOnly,
                'primary_muscle' => 'Hips',
                'equipment' => 'None',
                'instructions' => 'Step into a deep lunge, put the opposite hand on the floor, then rotate your other arm up towards the ceiling and follow it with your eyes. Return and swap sides.',
                'cues' => ['Back leg stays long', 'Rotate from the ribcage', 'Follow the hand with your head'],
            ],
            [
                'slug' => 'shoulder-dislocate',
                'name' => 'Shoulder pass-through',
                'category' => ExerciseCategory::Mobility,
                'metric' => ExerciseMetric::RepsOnly,
                'primary_muscle' => 'Shoulders',
                'equipment' => 'Band',
                'instructions' => 'Hold a band wide in front of you and, keeping your arms straight, take it up and over your head to behind your back, then return.',
                'cues' => ['Wide grip to start', 'Arms stay straight', 'Go only as far as is comfortable'],
            ],
            [
                'slug' => 'ankle-rock',
                'name' => 'Ankle rock',
                'category' => ExerciseCategory::Mobility,
                'metric' => ExerciseMetric::RepsOnly,
                'primary_muscle' => 'Ankles',
                'equipment' => 'None',
                'instructions' => 'In a half-kneeling position, drive your front knee forward over your toes without letting the heel lift, then rock back. Swap sides.',
                'cues' => ['Heel glued down', 'Knee travels over the toes', 'Small, repeated rocks'],
            ],
            [
                'slug' => 'glute-bridge',
                'name' => 'Glute bridge',
                'category' => ExerciseCategory::Mobility,
                'metric' => ExerciseMetric::RepsOnly,
                'primary_muscle' => 'Glutes',
                'equipment' => 'Bodyweight',
                'instructions' => 'Lie on your back with knees bent and feet flat. Press through your heels to lift your hips until your body is straight from knees to shoulders, then lower.',
                'cues' => ['Ribs down, no arching', 'Squeeze at the top', 'Push through the heels'],
            ],
        ];
    }
}
